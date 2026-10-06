import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'

export type FiltrosReintegrosTramitador = {
  bolsaId?: number | null
  desde?: string | null       // fecha de pago del gasto
  hasta?: string | null
  busqueda?: string | null    // nombre o identificación del tramitador
  soloPendientes?: boolean    // solo tramitadores que aún deben
  diasMinimos?: number | null // solo reintegros pendientes con al menos esta antigüedad
}

const numero = (valor: unknown) => Number(valor ?? 0)
const idONulo = (valor: unknown) => (valor === null || valor === undefined ? null : numero(valor))
const fechaISO = (valor: unknown) => (valor ? new Date(valor as string).toISOString() : null)

// Tramitador responsable del gasto: el que quedó en el gasto al crearlo o, si no, el de su trámite
const TRAMITADOR_DEL_GASTO = `COALESCE(g.tramitador_id, t."tramitadorId")`

// Gastos pagados (con su tramitador) que cumplen los filtros de bolsa y fecha de pago
const GASTOS_FILTRADOS = `
  SELECT g.id, g.codigo, g.concepto_pago, g.solicitud_tramite_id, g.valor_realmente_pagado,
    COALESCE(g.placa, g.matricula_inmobiliaria) AS referencia,
    ${TRAMITADOR_DEL_GASTO} AS tramitador_id
  FROM gastos_solicitudes g
  JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo NOT IN ('SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO', 'ANULADO')
  LEFT JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
  WHERE (CAST(:bolsaId AS INTEGER) IS NULL OR g.bolsa_id = CAST(:bolsaId AS INTEGER))
    AND (CAST(:desde AS DATE) IS NULL OR g.fecha_pago >= CAST(:desde AS DATE))
    AND (CAST(:hasta AS DATE) IS NULL OR g.fecha_pago <= CAST(:hasta AS DATE))
`

// Reintegros pendientes que cumplen la antigüedad mínima
const PENDIENTE_VIGENTE = `
  er.codigo = 'PENDIENTE'
  AND (CAST(:diasMinimos AS INTEGER) IS NULL OR r.created_at <= NOW() - make_interval(days => CAST(:diasMinimos AS INTEGER)))
`

const reemplazos = (filtros: FiltrosReintegrosTramitador) => ({
  bolsaId: filtros.bolsaId ?? null,
  desde: filtros.desde || null,
  hasta: filtros.hasta || null,
  busqueda: filtros.busqueda?.trim() ? `%${filtros.busqueda.trim()}%` : null,
  diasMinimos: filtros.diasMinimos ?? null
})

// =====================================
// DETALLE POR TRAMITADOR (pestaña de Tesorería, Legalización y Contabilidad)
// Una fila por tramitador con sus gastos, lo pendiente y lo reintegrado,
// más la lista de reintegros pendientes que componen su saldo
// =====================================
export const obtenerReintegrosPorTramitador = async (filtros: FiltrosReintegrosTramitador) => {
  const replacements = reemplazos(filtros)
  // Con antigüedad mínima solo tiene sentido ver a quienes deben
  const soloPendientes = filtros.soloPendientes || replacements.diasMinimos !== null

  const [resumen, pendientes] = await Promise.all([
    db.query<Record<string, unknown>>(`
      WITH gastos AS (${GASTOS_FILTRADOS}),
      reintegros AS (
        SELECT r.solicitud_gasto_id,
          SUM(r.valor_reintegro) FILTER (WHERE ${PENDIENTE_VIGENTE}) AS pendiente,
          SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'REINTEGRADO') AS reintegrado,
          MIN(r.created_at) FILTER (WHERE ${PENDIENTE_VIGENTE}) AS desde
        FROM gastos_reintegros r
        JOIN gastos_estados_reintegro er ON er.id = r.estado_id
        GROUP BY r.solicitud_gasto_id
      )
      SELECT
        gs.tramitador_id AS "tramitadorId", tr."nombreTramitador" AS nombre, tr.identificacion,
        COUNT(DISTINCT gs.solicitud_tramite_id) AS tramites,
        COUNT(gs.id) AS gastos,
        COALESCE(SUM(gs.valor_realmente_pagado), 0) AS pagado,
        COUNT(gs.id) FILTER (WHERE r.pendiente > 0) AS "gastosConReintegro",
        COALESCE(SUM(r.pendiente), 0) AS pendiente,
        COALESCE(SUM(r.reintegrado), 0) AS reintegrado,
        MIN(r.desde) AS "pendienteDesde"
      FROM gastos gs
      LEFT JOIN reintegros r ON r.solicitud_gasto_id = gs.id
      LEFT JOIN "Tramitador" tr ON tr.id = gs.tramitador_id
      WHERE (CAST(:busqueda AS TEXT) IS NULL OR tr."nombreTramitador" ILIKE :busqueda OR tr.identificacion ILIKE :busqueda)
      GROUP BY gs.tramitador_id, tr."nombreTramitador", tr.identificacion
      HAVING COALESCE(SUM(r.pendiente), 0) > 0 ${soloPendientes ? '' : 'OR COALESCE(SUM(r.reintegrado), 0) > 0'}
      ORDER BY pendiente DESC, reintegrado DESC
    `, { replacements, type: QueryTypes.SELECT }),

    db.query<Record<string, unknown>>(`
      WITH gastos AS (${GASTOS_FILTRADOS})
      SELECT
        r.id, gs.tramitador_id AS "tramitadorId",
        gs.id AS "gastoId", gs.codigo, gs.concepto_pago AS concepto,
        gs.solicitud_tramite_id AS "tramiteId", gs.referencia,
        gs.valor_realmente_pagado AS pagado, r.valor_reintegro AS valor, r.created_at AS desde
      FROM gastos_reintegros r
      JOIN gastos_estados_reintegro er ON er.id = r.estado_id
      JOIN gastos gs ON gs.id = r.solicitud_gasto_id
      WHERE ${PENDIENTE_VIGENTE}
      ORDER BY r.created_at
    `, { replacements, type: QueryTypes.SELECT })
  ])

  const filas = resumen.map(t => {
    const tramitadorId = idONulo(t.tramitadorId)
    return {
      tramitadorId,
      nombre: (t.nombre as string | null) ?? null,
      identificacion: (t.identificacion as string | null) ?? null,
      tramites: numero(t.tramites),
      gastos: numero(t.gastos),
      pagado: numero(t.pagado),
      gastosConReintegro: numero(t.gastosConReintegro),
      pendiente: numero(t.pendiente),
      reintegrado: numero(t.reintegrado),
      pendienteDesde: fechaISO(t.pendienteDesde),
      pendientes: pendientes
        .filter(p => idONulo(p.tramitadorId) === tramitadorId)
        .map(p => ({
          id: numero(p.id),
          gastoId: numero(p.gastoId),
          codigo: String(p.codigo),
          concepto: String(p.concepto),
          tramiteId: idONulo(p.tramiteId),
          referencia: (p.referencia as string | null) ?? null,
          pagado: numero(p.pagado),
          valor: numero(p.valor),
          desde: fechaISO(p.desde)!
        }))
    }
  })

  const sumar = (campo: 'pendiente' | 'reintegrado' | 'gastosConReintegro') =>
    Math.round(filas.reduce((s, f) => s + f[campo], 0) * 100) / 100

  return {
    totales: {
      tramitadores: filas.length,
      pendiente: sumar('pendiente'),
      reintegrado: sumar('reintegrado'),
      gastosConReintegro: sumar('gastosConReintegro')
    },
    tramitadores: filas
  }
}

// Tramos de antigüedad de los reintegros pendientes (días desde que se generó)
const TRAMOS = [
  { clave: 'd30', nombre: '0 a 30 días', hasta: 30 },
  { clave: 'd60', nombre: '31 a 60 días', hasta: 60 },
  { clave: 'd90', nombre: '61 a 90 días', hasta: 90 },
  { clave: 'mas90', nombre: 'Más de 90 días', hasta: null }
] as const

// =====================================
// RESUMEN GERENCIAL (Tablero): cuánto se debe, cuánto se ha recuperado,
// qué tan viejo es lo pendiente y quiénes concentran la deuda
// =====================================
export const obtenerResumenReintegros = async (filtros: FiltrosReintegrosTramitador) => {
  const replacements = reemplazos({ ...filtros, busqueda: null, diasMinimos: null })

  const [totales, tramos, principales] = await Promise.all([
    db.query<Record<string, unknown>>(`
      WITH gastos AS (${GASTOS_FILTRADOS})
      SELECT
        COALESCE(SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'PENDIENTE'), 0) AS pendiente,
        COUNT(r.id) FILTER (WHERE er.codigo = 'PENDIENTE') AS "cantidadPendientes",
        COALESCE(SUM(r.valor_reintegro) FILTER (WHERE er.codigo = 'REINTEGRADO'), 0) AS reintegrado,
        COUNT(DISTINCT COALESCE(gs.tramitador_id, 0)) FILTER (WHERE er.codigo = 'PENDIENTE') AS "tramitadoresConDeuda",
        COALESCE(AVG(EXTRACT(EPOCH FROM NOW() - r.created_at) / 86400) FILTER (WHERE er.codigo = 'PENDIENTE'), 0) AS "diasPromedio"
      FROM gastos_reintegros r
      JOIN gastos_estados_reintegro er ON er.id = r.estado_id
      JOIN gastos gs ON gs.id = r.solicitud_gasto_id
    `, { replacements, type: QueryTypes.SELECT }),

    db.query<Record<string, unknown>>(`
      WITH gastos AS (${GASTOS_FILTRADOS})
      SELECT
        CASE
          WHEN NOW() - r.created_at <= INTERVAL '30 days' THEN 'd30'
          WHEN NOW() - r.created_at <= INTERVAL '60 days' THEN 'd60'
          WHEN NOW() - r.created_at <= INTERVAL '90 days' THEN 'd90'
          ELSE 'mas90'
        END AS tramo,
        COUNT(r.id) AS cantidad,
        SUM(r.valor_reintegro) AS valor
      FROM gastos_reintegros r
      JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = 'PENDIENTE'
      JOIN gastos gs ON gs.id = r.solicitud_gasto_id
      GROUP BY 1
    `, { replacements, type: QueryTypes.SELECT }),

    db.query<Record<string, unknown>>(`
      WITH gastos AS (${GASTOS_FILTRADOS})
      SELECT gs.tramitador_id AS "tramitadorId", tr."nombreTramitador" AS nombre,
        COUNT(r.id) AS cantidad, SUM(r.valor_reintegro) AS valor
      FROM gastos_reintegros r
      JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = 'PENDIENTE'
      JOIN gastos gs ON gs.id = r.solicitud_gasto_id
      LEFT JOIN "Tramitador" tr ON tr.id = gs.tramitador_id
      GROUP BY gs.tramitador_id, tr."nombreTramitador"
      ORDER BY valor DESC
      LIMIT 5
    `, { replacements, type: QueryTypes.SELECT })
  ])

  const t = totales[0] ?? {}
  const pendiente = numero(t.pendiente)
  const reintegrado = numero(t.reintegrado)

  return {
    pendiente,
    cantidadPendientes: numero(t.cantidadPendientes),
    reintegrado,
    // Del total generado en reintegros, qué parte ya volvió a la bolsa
    recuperacion: pendiente + reintegrado > 0 ? reintegrado / (pendiente + reintegrado) : null,
    tramitadoresConDeuda: numero(t.tramitadoresConDeuda),
    diasPromedio: Math.round(numero(t.diasPromedio)),
    antiguedad: TRAMOS.map(tramo => {
      const fila = tramos.find(x => x.tramo === tramo.clave)
      return { clave: tramo.clave, nombre: tramo.nombre, cantidad: numero(fila?.cantidad), valor: numero(fila?.valor) }
    }),
    principales: principales.map(p => ({
      tramitadorId: idONulo(p.tramitadorId),
      nombre: (p.nombre as string | null) ?? null,
      cantidad: numero(p.cantidad),
      valor: numero(p.valor)
    }))
  }
}
