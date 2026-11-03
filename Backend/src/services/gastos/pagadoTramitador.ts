import ExcelJS from 'exceljs'
import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'

// =====================================
// PAGADO POR TRAMITADOR (pestaña de Tesorería, Legalización y Contabilidad; reemplaza a
// "Reintegros por tramitador", pedido del usuario 2026-11-03): lo que se le ha pagado a cada
// tramitador, gasto por gasto con su trámite y el estado del trámite, y en qué va ese dinero.
// Por gasto: facturado = valor de la factura (hasta lo pagado); por justificar = pagado − facturado −
// reintegrado − reintegro pendiente (sin bajar de 0): lo que el tramitador aún no ha soportado
// =====================================

export type FiltrosPagadoTramitador = {
  bolsaId?: number | null
  desde?: string | null          // fecha de pago del gasto
  hasta?: string | null
  busqueda?: string | null       // nombre o identificación del tramitador
  estadoTramite?: string | null  // nombre del estado actual del trámite ("Sin iniciar" si no tiene)
  mostrar?: 'todos' | 'porJustificar' | 'reintegroPendiente'
}

const numero = (valor: unknown) => Number(valor ?? 0)
const idONulo = (valor: unknown) => (valor === null || valor === undefined ? null : numero(valor))
const centavos = (valor: number) => Math.round(valor * 100) / 100

const DETALLE = `
  WITH reintegros AS (
    SELECT r.solicitud_gasto_id,
      COALESCE(SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'REINTEGRADO'), 0) AS reintegrado,
      COALESCE(SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'PENDIENTE'), 0) AS pendiente
    FROM gastos_reintegros r
    JOIN gastos_estados_reintegro er ON er.id = r.estado_id
    GROUP BY r.solicitud_gasto_id
  ), gastos AS (
    SELECT
      COALESCE(g.tramitador_id, t."tramitadorId") AS "tramitadorId",
      ta."nombreTramitador" AS nombre, ta.identificacion,
      g.id AS "gastoId", g.codigo, g.concepto_pago AS concepto, g.fecha_pago AS "fechaPago",
      b.nombre AS bolsa, tg.nombre AS "tipoGasto", e.nombre AS "estadoGasto",
      t.id AS "tramiteId", tr."nombreTramite" AS "tipoTramite",
      COALESCE(t.placa, t."matriculaInmobiliaria", g.placa, g.matricula_inmobiliaria) AS referencia,
      CASE WHEN t.id IS NULL THEN NULL ELSE COALESCE(es."nombreEstado", 'Sin iniciar') END AS "estadoTramite",
      f.numero_factura AS factura,
      g.valor_realmente_pagado AS pagado,
      LEAST(COALESCE(f.valor_factura, 0), g.valor_realmente_pagado) AS facturado,
      COALESCE(r.reintegrado, 0) AS reintegrado,
      COALESCE(r.pendiente, 0) AS "reintegroPendiente"
    FROM gastos_solicitudes g
    JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo NOT IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO', 'ANULADO')
    LEFT JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
    LEFT JOIN "Estados" es ON es.id = t."estadoActualTramite"
    LEFT JOIN "Tramites" tr ON tr.id = t."tramiteId"
    LEFT JOIN "Tramitador" ta ON ta.id = COALESCE(g.tramitador_id, t."tramitadorId")
    LEFT JOIN gastos_bolsas b ON b.id = g.bolsa_id
    LEFT JOIN gastos_tipos_gasto tg ON tg.id = g.tipo_gasto_id
    LEFT JOIN gastos_facturas f ON f.solicitud_gasto_id = g.id
    LEFT JOIN reintegros r ON r.solicitud_gasto_id = g.id
    WHERE (CAST(:bolsaId AS INTEGER) IS NULL OR g.bolsa_id = CAST(:bolsaId AS INTEGER))
      AND (CAST(:desde AS DATE) IS NULL OR g.fecha_pago >= CAST(:desde AS DATE))
      AND (CAST(:hasta AS DATE) IS NULL OR g.fecha_pago <= CAST(:hasta AS DATE))
      AND (CAST(:busqueda AS TEXT) IS NULL OR ta."nombreTramitador" ILIKE :busqueda OR ta.identificacion ILIKE :busqueda)
  )
  SELECT *, GREATEST(pagado - facturado - reintegrado - "reintegroPendiente", 0) AS "porJustificar"
  FROM gastos
  WHERE (CAST(:estadoTramite AS TEXT) IS NULL OR "estadoTramite" = :estadoTramite)
  ORDER BY nombre NULLS LAST, "tramiteId" NULLS LAST, "gastoId"
`

const reemplazos = (filtros: FiltrosPagadoTramitador) => ({
  bolsaId: filtros.bolsaId ?? null,
  desde: filtros.desde || null,
  hasta: filtros.hasta || null,
  busqueda: filtros.busqueda?.trim() ? `%${filtros.busqueda.trim()}%` : null,
  estadoTramite: filtros.estadoTramite?.trim() || null
})

const filasDetalle = async (filtros: FiltrosPagadoTramitador) => {
  const filas = await db.query<Record<string, unknown>>(DETALLE, { replacements: reemplazos(filtros), type: QueryTypes.SELECT })
  return filas.map(f => ({
    tramitadorId: idONulo(f.tramitadorId),
    nombre: (f.nombre as string | null) ?? null,
    identificacion: (f.identificacion as string | null) ?? null,
    gastoId: numero(f.gastoId),
    codigo: String(f.codigo),
    concepto: (f.concepto as string | null) ?? null,
    fechaPago: (f.fechaPago as string | null) ?? null,
    bolsa: (f.bolsa as string | null) ?? null,
    tipoGasto: (f.tipoGasto as string | null) ?? null,
    estadoGasto: String(f.estadoGasto),
    tramiteId: idONulo(f.tramiteId),
    tipoTramite: (f.tipoTramite as string | null) ?? null,
    referencia: (f.referencia as string | null) ?? null,
    estadoTramite: (f.estadoTramite as string | null) ?? null,
    factura: (f.factura as string | null) ?? null,
    pagado: numero(f.pagado),
    facturado: numero(f.facturado),
    reintegrado: numero(f.reintegrado),
    reintegroPendiente: numero(f.reintegroPendiente),
    porJustificar: numero(f.porJustificar)
  }))
}

type Detalle = Awaited<ReturnType<typeof filasDetalle>>[number]
const VALORES = ['pagado', 'facturado', 'reintegrado', 'reintegroPendiente', 'porJustificar'] as const
const sumar = (gastos: Detalle[]) =>
  Object.fromEntries(VALORES.map(v => [v, centavos(gastos.reduce((s, g) => s + g[v], 0))])) as Record<typeof VALORES[number], number>

export const obtenerPagadoPorTramitador = async (filtros: FiltrosPagadoTramitador) => {
  const detalle = await filasDetalle(filtros)

  // Agrupa por tramitador (sin tramitador al final, por el orden de la consulta)
  const grupos = new Map<number | null, Detalle[]>()
  for (const g of detalle) grupos.set(g.tramitadorId, [...(grupos.get(g.tramitadorId) ?? []), g])

  const tramitadores = [...grupos.values()]
    .map(gastos => ({
      tramitadorId: gastos[0].tramitadorId,
      nombre: gastos[0].nombre,
      identificacion: gastos[0].identificacion,
      tramites: new Set(gastos.map(g => g.tramiteId).filter(Boolean)).size,
      gastos: gastos.length,
      ...sumar(gastos),
      detalle: gastos
    }))
    .filter(t => filtros.mostrar === 'porJustificar' ? t.porJustificar > 0
      : filtros.mostrar === 'reintegroPendiente' ? t.reintegroPendiente > 0 : true)
    // Los que más tienen por justificar primero: es lo que Tesorería debe seguir
    .sort((a, b) => (a.tramitadorId === null ? 1 : 0) - (b.tramitadorId === null ? 1 : 0) || b.porJustificar - a.porJustificar || b.pagado - a.pagado)

  const incluidos = tramitadores.flatMap(t => t.detalle)
  return {
    totales: { tramitadores: tramitadores.filter(t => t.tramitadorId !== null).length, gastos: incluidos.length, ...sumar(incluidos) },
    tramitadores,
    // Para la lista de filtros: los estados que tienen los trámites de los gastos pagados
    estadosTramite: (await db.query<{ estado: string }>(`
      SELECT DISTINCT COALESCE(es."nombreEstado", 'Sin iniciar') AS estado
      FROM gastos_solicitudes g
      JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
      LEFT JOIN "Estados" es ON es.id = t."estadoActualTramite"
      ORDER BY 1
    `, { type: QueryTypes.SELECT })).map(e => e.estado)
  }
}

// Excel con los mismos filtros: hoja Por tramitador (resumen) y hoja Detalle (un gasto por fila)
export const excelPagadoPorTramitador = async (filtros: FiltrosPagadoTramitador) => {
  const { tramitadores } = await obtenerPagadoPorTramitador(filtros)

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Nodex Gastos'
  const MONEDA = '"$"#,##0.00'
  const columnasValor = [
    { header: 'Pagado', key: 'pagado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Facturado', key: 'facturado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Reintegrado', key: 'reintegrado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Reintegro pendiente', key: 'reintegroPendiente', width: 18, style: { numFmt: MONEDA } },
    { header: 'Por justificar', key: 'porJustificar', width: 16, style: { numFmt: MONEDA } }
  ]
  const encabezado = (hoja: ExcelJS.Worksheet) => {
    hoja.getRow(1).font = { bold: true }
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columns.length } }
  }

  const resumen = libro.addWorksheet('Por tramitador', { views: [{ state: 'frozen', ySplit: 1 }] })
  resumen.columns = [
    { header: 'Tramitador', key: 'nombre', width: 32 },
    { header: 'Identificación', key: 'identificacion', width: 16 },
    { header: 'Trámites', key: 'tramites', width: 10 },
    { header: 'Gastos', key: 'gastos', width: 10 },
    ...columnasValor
  ]
  tramitadores.forEach(t => resumen.addRow({ ...t, nombre: t.nombre ?? 'Sin tramitador' }))
  encabezado(resumen)

  const detalle = libro.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] })
  detalle.columns = [
    { header: 'Tramitador', key: 'nombre', width: 32 },
    { header: 'Identificación', key: 'identificacion', width: 16 },
    { header: 'Trámite', key: 'tramiteId', width: 10 },
    { header: 'Tipo de trámite', key: 'tipoTramite', width: 30 },
    { header: 'Placa / matrícula', key: 'referencia', width: 18 },
    { header: 'Estado del trámite', key: 'estadoTramite', width: 24 },
    { header: 'Gasto', key: 'codigo', width: 18 },
    { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Fecha de pago', key: 'fechaPago', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Bolsa', key: 'bolsa', width: 20 },
    { header: 'Tipo de gasto', key: 'tipoGasto', width: 20 },
    { header: 'Estado del gasto', key: 'estadoGasto', width: 20 },
    { header: 'Factura', key: 'factura', width: 16 },
    ...columnasValor
  ]
  tramitadores.flatMap(t => t.detalle).forEach(g => detalle.addRow({
    ...g,
    nombre: g.nombre ?? 'Sin tramitador',
    estadoTramite: g.estadoTramite ?? 'Sin trámite',
    // DATEONLY llega como texto: fecha sin hora para que Excel no la corra de día
    fechaPago: g.fechaPago ? new Date(`${g.fechaPago.slice(0, 10)}T00:00:00Z`) : null
  }))
  encabezado(detalle)

  return libro.xlsx.writeBuffer()
}
