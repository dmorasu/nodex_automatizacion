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

// El gasto está en una cuenta de cobro activa (reembolsable: su valor vuelve a la bolsa al legalizar)
const EN_CUENTA = `EXISTS (
  SELECT 1 FROM gastos_cuentas_cobro_gastos l
  JOIN gastos_cuentas_cobro c ON c.id = l.cuenta_cobro_id
  JOIN gastos_estados_cuenta_cobro ec ON ec.id = c.estado_id
  WHERE l.solicitud_gasto_id = g.id AND ec.codigo <> 'ANULADA'
)`

// Filtro por fecha de pago del gasto (el saldo de la bolsa siempre es el actual)
const FILTRO_FECHA = `
  (CAST(:desde AS DATE) IS NULL OR g.fecha_pago >= CAST(:desde AS DATE))
  AND (CAST(:hasta AS DATE) IS NULL OR g.fecha_pago <= CAST(:hasta AS DATE))
`

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

  const [bolsas, reintegros, cuentas, resumenReintegros] = await Promise.all([
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

    obtenerResumenReintegros(filtros)
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
    reintegros: resumenReintegros
  }
}
