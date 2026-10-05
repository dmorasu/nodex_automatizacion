import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'

// =====================================
// API EXTERNA: TRÁMITES DE LOS MENSAJEROS
// Para otra plataforma (sin sesión de usuario; se protege con API key en el router).
// Solo trámites asignados a tramitadores marcados como mensajeros.
//   · fechaInicio / horaInicio: día de la diligencia (Programacion.fechaProbableEntrega, el
//     mismo día que usan las rutas) y la hora de la cita si la tiene.
//   · fechaFin: finalización del servicio (Programacion.fechaFinalizacionServicio).
//   · estado: estado actual del trámite (SolicitudTramites.estadoActualTramite).
// =====================================

export const TAMANO_MAXIMO = 500

export type FiltrosTramitesMensajeros = {
  tramitadorId?: number
  estadoId?: number
  desde?: string // día de la diligencia, YYYY-MM-DD
  hasta?: string
  pagina: number
  tamano: number
}

type Fila = {
  tramitadorId: number
  nombreTramitador: string | null
  tramiteId: number
  fechaInicio: string | null
  horaInicio: string | null
  fechaFin: Date | null
  municipio: string | null
  departamento: string | null
  direccion: string | null
  latitud: number | null
  longitud: number | null
  tipoDiligencia: string | null
  estado: string
}

export const listarTramitesMensajeros = async (filtros: FiltrosTramitesMensajeros) => {
  const condiciones = ['t."esMensajero" = true']
  const reemplazos: Record<string, unknown> = {
    limite: filtros.tamano,
    desplazamiento: (filtros.pagina - 1) * filtros.tamano
  }

  if (filtros.tramitadorId) {
    condiciones.push('s."tramitadorId" = :tramitadorId')
    reemplazos.tramitadorId = filtros.tramitadorId
  }
  if (filtros.estadoId) {
    condiciones.push('s."estadoActualTramite" = :estadoId')
    reemplazos.estadoId = filtros.estadoId
  }
  // El día de la diligencia se toma como en las rutas: la fecha guardada en UTC
  if (filtros.desde) {
    condiciones.push(`(p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date >= CAST(:desde AS DATE)`)
    reemplazos.desde = filtros.desde
  }
  if (filtros.hasta) {
    condiciones.push(`(p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date <= CAST(:hasta AS DATE)`)
    reemplazos.hasta = filtros.hasta
  }

  const desde = `
    FROM "SolicitudTramites" s
    JOIN "Tramitador" t ON t.id = s."tramitadorId"
    -- Una programación por trámite (la más reciente, por si quedó alguna repetida)
    LEFT JOIN LATERAL (
      SELECT pr."fechaProbableEntrega", pr."horaCita", pr."fechaFinalizacionServicio"
      FROM "Programacion" pr WHERE pr."solicitudTramiteId" = s.id
      ORDER BY pr.id DESC LIMIT 1
    ) p ON true
    LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
    LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    WHERE ${condiciones.join(' AND ')}
  `

  const [filas, [{ total }]] = await Promise.all([
    db.query<Fila>(`
      SELECT
        s."tramitadorId" AS "tramitadorId",
        TRIM(t."nombreTramitador") AS "nombreTramitador",
        s.id AS "tramiteId",
        TO_CHAR((p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS "fechaInicio",
        TO_CHAR(p."horaCita", 'HH24:MI') AS "horaInicio",
        p."fechaFinalizacionServicio" AS "fechaFin",
        m."nombreMunicipio" AS municipio,
        m.departamento,
        s."direccionTramite" AS direccion,
        s.latitud,
        s.longitud,
        tr."nombreTramite" AS "tipoDiligencia",
        COALESCE(e."nombreEstado", 'Sin iniciar') AS estado
      ${desde}
      ORDER BY s.id
      LIMIT :limite OFFSET :desplazamiento
    `, { type: QueryTypes.SELECT, replacements: reemplazos }),
    db.query<{ total: number }>(`SELECT COUNT(*)::int AS total ${desde}`, { type: QueryTypes.SELECT, replacements: reemplazos })
  ])

  return {
    pagina: filtros.pagina,
    tamano: filtros.tamano,
    total,
    paginas: Math.max(1, Math.ceil(total / filtros.tamano)),
    datos: filas.map(f => ({
      ...f,
      latitud: f.latitud === null ? null : Number(f.latitud),
      longitud: f.longitud === null ? null : Number(f.longitud)
    }))
  }
}
