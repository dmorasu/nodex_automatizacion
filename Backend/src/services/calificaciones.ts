import { QueryTypes } from 'sequelize'
import { db } from '../config/db'

// =====================================
// CALIFICACIONES (2026-10-25)
// La encuesta que se llena al finalizar un trámite (EvaluacionSolicitudes: 5 preguntas de 1 a 4,
// Malo / Regular / Bueno / Excelente) vista por trámite y por tramitador, con los finalizados que
// aún no la tienen para hacerla desde ahí. El periodo (opcional) es por fecha de finalizado (día de Bogotá).
// =====================================

const ESTADO_FINALIZADO = 6
const POR_PAGINA = 50

export type FiltrosCalificaciones = {
  // Sin fechas: todos los finalizados
  desde?: string | null
  hasta?: string | null
  tramitadorId?: number | null
  // todas | calificados | sinCalificar
  estado?: string
  q?: string
  pagina?: number
}

// Condiciones comunes: finalizados en el periodo (y del tramitador, y la búsqueda)
const condiciones = ({ desde, hasta, tramitadorId, q }: FiltrosCalificaciones) => {
  const partes = [`s."estadoActualTramite" = :finalizado`]
  if (desde) partes.push(`(p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota')::date >= CAST(:desde AS DATE)`)
  if (hasta) partes.push(`(p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota')::date <= CAST(:hasta AS DATE)`)
  if (tramitadorId) partes.push(`s."tramitadorId" = :tramitadorId`)
  if (tramitadorId === 0) partes.push(`s."tramitadorId" IS NULL`)
  if (q?.trim()) partes.push(`(s.id::text = :q OR s.placa ILIKE :texto OR s."matriculaInmobiliaria" ILIKE :texto OR cr."nombreUsuario" ILIKE :texto)`)
  return partes.join(' AND ')
}

const reemplazos = (f: FiltrosCalificaciones) => ({
  finalizado: ESTADO_FINALIZADO,
  desde: f.desde ?? null,
  hasta: f.hasta ?? null,
  tramitadorId: f.tramitadorId ?? null,
  q: f.q?.trim().replace(/^#/, '') ?? '',
  texto: `%${f.q?.trim() ?? ''}%`
})

const DESDE = `
  FROM "SolicitudTramites" s
  JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
  LEFT JOIN "EvaluacionSolicitudes" ev ON ev."solicitudTramiteId" = s.id
  LEFT JOIN "Usuarios" cr ON cr.id = s."usuarioId"
`

export const calificacionesPorTramite = async (filtros: FiltrosCalificaciones) => {
  const donde = condiciones(filtros)
  const deEstado = filtros.estado === 'calificados' ? ' AND ev.id IS NOT NULL' : filtros.estado === 'sinCalificar' ? ' AND ev.id IS NULL' : ''
  const pagina = Math.max(1, filtros.pagina ?? 1)
  const valores = reemplazos(filtros)

  const [filas, [resumen]] = await Promise.all([
    db.query<Record<string, unknown>>(`
      SELECT
        s.id, COALESCE(s.placa, s."matriculaInmobiliaria") AS placa, tr."nombreTramite" AS tipo, cr."nombreUsuario" AS "creadoPor",
        t.id AS "tramitadorId", t."nombreTramitador" AS tramitador,
        to_char((p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS finalizado,
        ev.promedio, ev."createdAt" AS "evaluadaEn", u."nombreUsuario" AS "evaluadaPor"
      ${DESDE}
      LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
      LEFT JOIN "Tramitador" t ON t.id = s."tramitadorId"
      LEFT JOIN "Usuarios" u ON u.id = ev."usuarioId"
      WHERE ${donde}${deEstado}
      ORDER BY p."fechaFinalizacionServicio" DESC, s.id DESC
      LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}
    `, { type: QueryTypes.SELECT, replacements: valores }),
    // El resumen no depende del filtro de estado: así se ve cuántos faltan por calificar
    db.query<{ finalizados: string, calificados: string, promedio: string | null, bajas: string }>(`
      SELECT COUNT(*) AS finalizados, COUNT(ev.id) AS calificados, AVG(ev.promedio) AS promedio,
        COUNT(*) FILTER (WHERE ev.promedio < 3) AS bajas
      ${DESDE}
      WHERE ${donde}
    `, { type: QueryTypes.SELECT, replacements: valores })
  ])

  const calificados = Number(resumen.calificados)
  const finalizados = Number(resumen.finalizados)
  return {
    tramites: filas.map(f => ({ ...f, promedio: f.promedio === null ? null : Number(f.promedio) })),
    total: filtros.estado === 'calificados' ? calificados : filtros.estado === 'sinCalificar' ? finalizados - calificados : finalizados,
    porPagina: POR_PAGINA,
    resumen: {
      finalizados,
      calificados,
      sinCalificar: finalizados - calificados,
      promedio: resumen.promedio === null ? null : Math.round(Number(resumen.promedio) * 100) / 100,
      bajas: Number(resumen.bajas)
    }
  }
}

// Una fila por tramitador: finalizados, calificados, promedio general, promedio de cada pregunta y
// cuántas calificaciones bajas (promedio menor a 3 = por debajo de "Bueno")
export const calificacionesPorTramitador = async (filtros: FiltrosCalificaciones) => {
  const donde = condiciones({ ...filtros, tramitadorId: null })
  const valores = reemplazos({ ...filtros, tramitadorId: null })

  const [preguntas, filas, porPregunta] = await Promise.all([
    db.query<{ id: number, texto: string, orden: number }>(
      `SELECT id, texto, orden FROM "EvaluacionPreguntas" WHERE activa ORDER BY orden`, { type: QueryTypes.SELECT }),
    db.query<{ tramitadorId: number | null, tramitador: string | null, finalizados: string, calificados: string, promedio: string | null, bajas: string }>(`
      SELECT s."tramitadorId", t."nombreTramitador" AS tramitador,
        COUNT(*) AS finalizados, COUNT(ev.id) AS calificados, AVG(ev.promedio) AS promedio,
        COUNT(*) FILTER (WHERE ev.promedio < 3) AS bajas
      ${DESDE}
      LEFT JOIN "Tramitador" t ON t.id = s."tramitadorId"
      WHERE ${donde}
      GROUP BY s."tramitadorId", t."nombreTramitador"
    `, { type: QueryTypes.SELECT, replacements: valores }),
    db.query<{ tramitadorId: number | null, preguntaId: number, promedio: string }>(`
      SELECT s."tramitadorId", r."preguntaId", AVG(r.calificacion) AS promedio
      ${DESDE}
      JOIN "EvaluacionRespuestas" r ON r."evaluacionSolicitudId" = ev.id
      WHERE ${donde}
      GROUP BY s."tramitadorId", r."preguntaId"
    `, { type: QueryTypes.SELECT, replacements: valores })
  ])

  const redondear = (v: string | null) => (v === null ? null : Math.round(Number(v) * 100) / 100)
  return {
    preguntas,
    tramitadores: filas
      .map(f => ({
        tramitadorId: f.tramitadorId,
        tramitador: f.tramitador?.trim() || 'Sin tramitador',
        finalizados: Number(f.finalizados),
        calificados: Number(f.calificados),
        promedio: redondear(f.promedio),
        bajas: Number(f.bajas),
        porPregunta: Object.fromEntries(porPregunta
          .filter(x => x.tramitadorId === f.tramitadorId)
          .map(x => [x.preguntaId, redondear(x.promedio)]))
      }))
      // Los de promedio más bajo primero: son los que hay que revisar
      .sort((a, b) => (a.promedio ?? 99) - (b.promedio ?? 99) || b.finalizados - a.finalizados)
  }
}

// Meses con trámites finalizados (para elegir cuál ver), del más reciente al más antiguo
export const mesesConFinalizados = () =>
  db.query<{ mes: string, finalizados: string, sinCalificar: string }>(`
    SELECT to_char(p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota', 'YYYY-MM') AS mes,
      COUNT(*) AS finalizados, COUNT(*) FILTER (WHERE ev.id IS NULL) AS "sinCalificar"
    ${DESDE}
    WHERE s."estadoActualTramite" = :finalizado AND p."fechaFinalizacionServicio" IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC
  `, { type: QueryTypes.SELECT, replacements: { finalizado: ESTADO_FINALIZADO } })
    .then(filas => filas.map(f => ({ mes: f.mes, finalizados: Number(f.finalizados), sinCalificar: Number(f.sinCalificar) })))
