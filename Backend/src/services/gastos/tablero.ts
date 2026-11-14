import ExcelJS from 'exceljs'
import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import { obtenerResumenReintegros } from './reintegrosTramitador'

export type FiltrosTablero = {
  bolsaId?: number | null
  desde?: string | null   // fecha de pago desde (YYYY-MM-DD)
  hasta?: string | null   // fecha de pago hasta (YYYY-MM-DD)
}

// Los valores de dinero llegan de PostgreSQL como texto
const numero = (valor: unknown) => Number(valor ?? 0)

// El gasto está en una cuenta de cobro activa (reembolsable: su valor vuelve a la bolsa al legalizar).
// Las de legalización sin pago (2026-11-13) no devuelven el dinero: su gasto cuenta como asumido
const EN_CUENTA = `EXISTS (
  SELECT 1 FROM gastos_cuentas_cobro_gastos l
  JOIN gastos_cuentas_cobro c ON c.id = l.cuenta_cobro_id
  JOIN gastos_estados_cuenta_cobro ec ON ec.id = c.estado_id
  WHERE l.solicitud_gasto_id = g.id AND ec.codigo <> 'ANULADA' AND c.tipo <> 'LEGALIZACION_SIN_PAGO'
)`

// Filtro por fecha de pago del gasto (el saldo de la bolsa siempre es el actual)
const FILTRO_FECHA = `
  (CAST(:desde AS DATE) IS NULL OR g.fecha_pago >= CAST(:desde AS DATE))
  AND (CAST(:hasta AS DATE) IS NULL OR g.fecha_pago <= CAST(:hasta AS DATE))
`

// Gasto pagado (lo que salió de la bolsa), igual que "Pagado" del tablero
const PAGADO = `e.codigo NOT IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO', 'ANULADO') AND ${FILTRO_FECHA}`
const FILTRO_BOLSA = '(CAST(:bolsaId AS INTEGER) IS NULL OR g.bolsa_id = CAST(:bolsaId AS INTEGER))'
// Sin estado registrado el trámite aún no ha iniciado (como en el resto de Nodex)
const ESTADO_TRAMITE = `COALESCE(es."nombreEstado", 'Sin iniciar')`

// Pagado en gastos con trámite, por el estado actual del trámite (pedido del usuario, 2026-11-03):
// muestra, por ejemplo, cuánto se pagó en trámites desistidos o todavía en curso
const pagadoPorEstadoTramite = (replacements: Record<string, unknown>) =>
  db.query<Record<string, unknown>>(`
    SELECT ${ESTADO_TRAMITE} AS estado,
      COUNT(DISTINCT t.id) AS tramites, COUNT(g.id) AS gastos,
      COALESCE(SUM(g.valor_realmente_pagado), 0) AS pagado
    FROM gastos_solicitudes g
    JOIN gastos_estados_gasto e ON e.id = g.estado_id
    JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
    LEFT JOIN "Estados" es ON es.id = t."estadoActualTramite"
    WHERE ${PAGADO} AND ${FILTRO_BOLSA}
    GROUP BY 1
    ORDER BY pagado DESC
  `, { replacements, type: QueryTypes.SELECT })

// =====================================
// TABLERO POR BOLSA
// · porPagar: valor solicitado de gastos aún no pagados
// · pagado: lo que salió de la bolsa (valor pagado)
// · sinFactura: pagado sin factura registrada
// · facturadoSinCuenta / enCuentaCobro: valor a legalizar que aún no vuelve a la bolsa
// · legalizado: valor legalizado que ya volvió a la bolsa (por cuenta de cobro)
// · gastoAsumido: no reembolsables legalizados; la bolsa asume el valor real (no vuelve)
// · reintegroPendiente / reintegrado: sobrantes que devuelven los tramitadores
// =====================================
export const obtenerTablero = async (filtros: FiltrosTablero) => {
  const replacements = {
    bolsaId: filtros.bolsaId ?? null,
    desde: filtros.desde || null,
    hasta: filtros.hasta || null
  }

  const [bolsas, reintegros, cuentas, resumenReintegros, porEstadoTramite] = await Promise.all([
    db.query<Record<string, unknown>>(`
      SELECT
        b.id, b.nombre, b.linea_negocio AS "lineaNegocio", b.activo, b.saldo_actual AS saldo,
        -- Por pagar incluye lo programado y lo aprobado que aún no se confirma
        COALESCE(SUM(g.valor_solicitado_pago) FILTER (WHERE e.codigo IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO')), 0) AS "porPagar",
        COUNT(g.id) FILTER (WHERE e.codigo IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO')) AS "gastosPorPagar",
        COALESCE(SUM(g.valor_realmente_pagado) FILTER (WHERE e.codigo NOT IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO', 'ANULADO') AND ${FILTRO_FECHA}), 0) AS pagado,
        COUNT(g.id) FILTER (WHERE e.codigo NOT IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO', 'ANULADO') AND ${FILTRO_FECHA}) AS "gastosPagados",
        COALESCE(SUM(g.valor_realmente_pagado) FILTER (WHERE e.codigo = 'PAGADO' AND ${FILTRO_FECHA}), 0) AS "sinFactura",
        COALESCE(SUM(f.valor_legalizado) FILTER (WHERE e.codigo = 'FACTURADO' AND ${FILTRO_FECHA}), 0) AS "facturadoSinCuenta",
        COALESCE(SUM(f.valor_legalizado) FILTER (WHERE e.codigo = 'EN_CUENTA_COBRO' AND ${FILTRO_FECHA}), 0) AS "enCuentaCobro",
        COALESCE(SUM(f.valor_legalizado) FILTER (WHERE e.codigo IN ('LEGALIZADO', 'CONTABILIZADO') AND ${EN_CUENTA} AND ${FILTRO_FECHA}), 0) AS legalizado,
        COALESCE(SUM(LEAST(f.valor_factura, g.valor_realmente_pagado)) FILTER (WHERE e.codigo IN ('LEGALIZADO', 'CONTABILIZADO') AND NOT ${EN_CUENTA} AND ${FILTRO_FECHA}), 0) AS "gastoAsumido"
      FROM gastos_bolsas b
      LEFT JOIN gastos_solicitudes g ON g.bolsa_id = b.id
      LEFT JOIN gastos_estados_gasto e ON e.id = g.estado_id
      LEFT JOIN gastos_facturas f ON f.solicitud_gasto_id = g.id
      WHERE (CAST(:bolsaId AS INTEGER) IS NULL OR b.id = CAST(:bolsaId AS INTEGER))
      GROUP BY b.id
      ORDER BY b.activo DESC, b.nombre
    `, { replacements, type: QueryTypes.SELECT }),

    db.query<Record<string, unknown>>(`
      SELECT
        g.bolsa_id AS "bolsaId",
        COALESCE(SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'PENDIENTE'), 0) AS pendiente,
        COALESCE(SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'REINTEGRADO'), 0) AS reintegrado
      FROM gastos_reintegros r
      JOIN gastos_solicitudes g ON g.id = r.solicitud_gasto_id
      JOIN gastos_estados_reintegro er ON er.id = r.estado_id
      WHERE (CAST(:bolsaId AS INTEGER) IS NULL OR g.bolsa_id = CAST(:bolsaId AS INTEGER))
        AND ${FILTRO_FECHA}
      GROUP BY g.bolsa_id
    `, { replacements, type: QueryTypes.SELECT }),

    // Cuentas de cobro en borrador: facturas listas para legalizar, por cuenta y bolsa
    db.query<Record<string, unknown>>(`
      SELECT
        c.id, c.numero_cuenta_cobro AS "numeroCuentaCobro",
        g.bolsa_id AS "bolsaId", b.nombre AS bolsa,
        COUNT(l.id) AS gastos,
        COALESCE(SUM(l.valor_legalizado), 0) AS "valorLegalizado"
      FROM gastos_cuentas_cobro c
      JOIN gastos_estados_cuenta_cobro ec ON ec.id = c.estado_id AND ec.codigo = 'BORRADOR'
      JOIN gastos_cuentas_cobro_gastos l ON l.cuenta_cobro_id = c.id
      JOIN gastos_solicitudes g ON g.id = l.solicitud_gasto_id
      LEFT JOIN gastos_bolsas b ON b.id = g.bolsa_id
      WHERE (CAST(:bolsaId AS INTEGER) IS NULL OR g.bolsa_id = CAST(:bolsaId AS INTEGER))
      GROUP BY c.id, g.bolsa_id, b.nombre
      ORDER BY c.numero_cuenta_cobro
    `, { replacements, type: QueryTypes.SELECT }),

    obtenerResumenReintegros(filtros),
    pagadoPorEstadoTramite(replacements)
  ])

  const filas = bolsas.map(b => {
    const r = reintegros.find(x => numero(x.bolsaId) === numero(b.id))

    return {
      id: numero(b.id),
      nombre: String(b.nombre),
      lineaNegocio: (b.lineaNegocio as string | null) ?? null,
      activo: Boolean(b.activo),
      saldo: numero(b.saldo),
      porPagar: numero(b.porPagar),
      gastosPorPagar: numero(b.gastosPorPagar),
      pagado: numero(b.pagado),
      gastosPagados: numero(b.gastosPagados),
      sinFactura: numero(b.sinFactura),
      facturadoSinCuenta: numero(b.facturadoSinCuenta),
      enCuentaCobro: numero(b.enCuentaCobro),
      legalizado: numero(b.legalizado),
      gastoAsumido: numero(b.gastoAsumido),
      reintegroPendiente: numero(r?.pendiente),
      reintegrado: numero(r?.reintegrado)
    }
  })

  const sumar = (campo: keyof typeof filas[number]) =>
    Math.round(filas.reduce((suma, f) => suma + Number(f[campo]), 0) * 100) / 100

  return {
    filtros: replacements,
    totales: {
      saldo: sumar('saldo'),
      porPagar: sumar('porPagar'),
      gastosPorPagar: sumar('gastosPorPagar'),
      pagado: sumar('pagado'),
      gastosPagados: sumar('gastosPagados'),
      sinFactura: sumar('sinFactura'),
      facturadoSinCuenta: sumar('facturadoSinCuenta'),
      enCuentaCobro: sumar('enCuentaCobro'),
      legalizado: sumar('legalizado'),
      gastoAsumido: sumar('gastoAsumido'),
      reintegroPendiente: sumar('reintegroPendiente'),
      reintegrado: sumar('reintegrado')
    },
    bolsas: filas,
    cuentasPorLegalizar: cuentas.map(c => ({
      id: numero(c.id),
      numeroCuentaCobro: String(c.numeroCuentaCobro),
      bolsaId: c.bolsaId === null ? null : numero(c.bolsaId),
      bolsa: (c.bolsa as string | null) ?? null,
      gastos: numero(c.gastos),
      valorLegalizado: numero(c.valorLegalizado)
    })),
    reintegros: resumenReintegros,
    porEstadoTramite: porEstadoTramite.map(f => ({
      estado: String(f.estado),
      tramites: numero(f.tramites),
      gastos: numero(f.gastos),
      pagado: numero(f.pagado)
    }))
  }
}

// Excel del pagado por estado del trámite: hoja Resumen (lo mismo de la pantalla) y hoja Gastos
// (un gasto pagado con trámite por fila, con los mismos filtros)
export const excelPagadoPorEstadoTramite = async (filtros: FiltrosTablero) => {
  const replacements = { bolsaId: filtros.bolsaId ?? null, desde: filtros.desde || null, hasta: filtros.hasta || null }
  const [resumen, gastos] = await Promise.all([
    pagadoPorEstadoTramite(replacements),
    db.query<Record<string, unknown>>(`
      SELECT ${ESTADO_TRAMITE} AS "estadoTramite", t.id AS tramite, tr."nombreTramite" AS "tipoTramite",
        COALESCE(t.placa, t."matriculaInmobiliaria") AS identificacion, c."nombreCliente" AS cliente,
        ta."nombreTramitador" AS tramitador,
        g.codigo, g.fecha_pago AS "fechaPago", b.nombre AS bolsa, tg.nombre AS "tipoGasto",
        e.nombre AS "estadoGasto", g.valor_realmente_pagado AS pagado
      FROM gastos_solicitudes g
      JOIN gastos_estados_gasto e ON e.id = g.estado_id
      JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
      LEFT JOIN "Estados" es ON es.id = t."estadoActualTramite"
      LEFT JOIN "Tramites" tr ON tr.id = t."tramiteId"
      LEFT JOIN "Clientes" c ON c.id = t."clienteId"
      LEFT JOIN "Tramitador" ta ON ta.id = COALESCE(g.tramitador_id, t."tramitadorId")
      LEFT JOIN gastos_bolsas b ON b.id = g.bolsa_id
      LEFT JOIN gastos_tipos_gasto tg ON tg.id = g.tipo_gasto_id
      WHERE ${PAGADO} AND ${FILTRO_BOLSA}
      ORDER BY 1, t.id, g.id
    `, { replacements, type: QueryTypes.SELECT })
  ])

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Nodex Gastos'
  const MONEDA = '"$"#,##0.00'
  const encabezado = (hoja: ExcelJS.Worksheet) => {
    hoja.getRow(1).font = { bold: true }
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columns.length } }
  }

  const hojaResumen = libro.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] })
  hojaResumen.columns = [
    { header: 'Estado del trámite', key: 'estado', width: 28 },
    { header: 'Trámites', key: 'tramites', width: 12 },
    { header: 'Gastos', key: 'gastos', width: 12 },
    { header: 'Valor pagado', key: 'pagado', width: 20, style: { numFmt: MONEDA } }
  ]
  resumen.forEach(f => hojaResumen.addRow({ estado: f.estado, tramites: numero(f.tramites), gastos: numero(f.gastos), pagado: numero(f.pagado) }))
  const total = hojaResumen.addRow({ estado: 'Total', gastos: resumen.reduce((s, f) => s + numero(f.gastos), 0), pagado: resumen.reduce((s, f) => s + numero(f.pagado), 0) })
  total.font = { bold: true }
  encabezado(hojaResumen)

  const hojaGastos = libro.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 1 }] })
  hojaGastos.columns = [
    { header: 'Estado del trámite', key: 'estadoTramite', width: 24 },
    { header: 'Trámite', key: 'tramite', width: 10 },
    { header: 'Tipo de trámite', key: 'tipoTramite', width: 32 },
    { header: 'Placa / matrícula', key: 'identificacion', width: 18 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Tramitador', key: 'tramitador', width: 28 },
    { header: 'Gasto', key: 'codigo', width: 18 },
    { header: 'Fecha de pago', key: 'fechaPago', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Bolsa', key: 'bolsa', width: 22 },
    { header: 'Tipo de gasto', key: 'tipoGasto', width: 22 },
    { header: 'Estado del gasto', key: 'estadoGasto', width: 20 },
    { header: 'Valor pagado', key: 'pagado', width: 18, style: { numFmt: MONEDA } }
  ]
  gastos.forEach(f => hojaGastos.addRow({
    ...f,
    tramite: numero(f.tramite),
    // DATEONLY llega como texto: se arma la fecha sin hora para que Excel no la corra de día
    fechaPago: f.fechaPago ? new Date(`${String(f.fechaPago).slice(0, 10)}T00:00:00Z`) : null,
    pagado: numero(f.pagado)
  }))
  encabezado(hojaGastos)

  return { buffer: await libro.xlsx.writeBuffer(), filas: gastos.length }
}
