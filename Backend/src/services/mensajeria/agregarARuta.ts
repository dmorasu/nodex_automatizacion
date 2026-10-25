import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import SolicitudTramites from '../../models/solicitudTramites'
import Programacion from '../../models/programacion'
import { notificarProgramacion } from '../notificacionesProgramacion'
import { ErrorUbicacion } from './ubicacion'

// =====================================
// AGREGAR TRÁMITES A LA RUTA DE UN MENSAJERO (desde Rutas)
// Un trámite está en la ruta de un día si tiene ese mensajero y esa fecha de diligencia
// (ver rutas.ts). Agregarlo = asignarle el mensajero y la fecha; la parada se crea sola al
// consultar la ruta y entra al final. Decisiones del usuario: los avisos salen igual que al
// programar desde el trámite, y si no tiene programación se crea solo con la fecha.
// =====================================

const ESTADOS_CERRADOS = ['Finalizado', 'Desistido']
export const MAXIMO_AGREGAR = 30

export type TramiteParaRuta = {
  id: number
  cliente: string | null
  direccion: string | null
  municipio: string | null
  tramitador: string | null
  fechaDiligencia: string | null
  // Por qué no se puede agregar (null = se puede)
  problema: string | null
}

const idsValidos = (ids: unknown): number[] => {
  const lista = Array.isArray(ids) ? [...new Set(ids.map(Number))] : []
  if (!lista.length || !lista.every(id => Number.isInteger(id) && id > 0)) throw new ErrorUbicacion('Indique los números de los trámites')
  if (lista.length > MAXIMO_AGREGAR) throw new ErrorUbicacion(`Máximo ${MAXIMO_AGREGAR} trámites por vez`)
  return lista
}

const mensajeroActivo = async (tramitadorId: number) => {
  const mensajero = await Tramitador.findByPk(tramitadorId, { attributes: ['id', 'nombreTramitador', 'esMensajero', 'activo'] })
  if (!mensajero || !mensajero.esMensajero || !mensajero.activo) throw new ErrorUbicacion('El mensajero no existe o no está activo', 404)
  return mensajero
}

// Vista previa: datos de cada trámite y si se puede agregar a la ruta de ese día
export const revisarTramitesParaRuta = async (fecha: string, tramitadorId: number, ids: unknown): Promise<TramiteParaRuta[]> => {
  const lista = idsValidos(ids)
  await mensajeroActivo(tramitadorId)

  const filas = await db.query<{
    id: number, cliente: string | null, direccion: string | null, municipio: string | null,
    tramitadorId: number | null, tramitador: string | null, fechaDiligencia: string | null, estado: string | null
  }>(`
    SELECT s.id, c."nombreCliente" AS cliente, s."direccionTramite" AS direccion, m."nombreMunicipio" AS municipio,
      s."tramitadorId", t."nombreTramitador" AS tramitador,
      -- La fecha de diligencia se guarda como medianoche UTC del día programado
      to_char((p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS "fechaDiligencia",
      e."nombreEstado" AS estado
    FROM "SolicitudTramites" s
    LEFT JOIN "Clientes" c ON c.id = s."clienteId"
    LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
    LEFT JOIN "Tramitador" t ON t.id = s."tramitadorId"
    LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    WHERE s.id IN (:ids)
  `, { type: QueryTypes.SELECT, replacements: { ids: lista } })

  const porId = new Map(filas.map(f => [Number(f.id), f]))
  return lista.map(id => {
    const f = porId.get(id)
    if (!f) return { id, cliente: null, direccion: null, municipio: null, tramitador: null, fechaDiligencia: null, problema: 'No existe' }
    const problema = f.estado && ESTADOS_CERRADOS.includes(f.estado) ? `Está ${f.estado.toLowerCase()}`
      : Number(f.tramitadorId) === tramitadorId && f.fechaDiligencia === fecha ? 'Ya está en esta ruta'
        : null
    return { id, cliente: f.cliente, direccion: f.direccion, municipio: f.municipio, tramitador: f.tramitador, fechaDiligencia: f.fechaDiligencia, problema }
  })
}

// Asigna el mensajero y la fecha de diligencia a cada trámite que se pueda; los demás se
// devuelven con su motivo. Cada trámite va en su propia transacción: uno que falle no frena a los otros.
export const agregarTramitesARuta = async (fecha: string, tramitadorId: number, ids: unknown) => {
  const revision = await revisarTramitesParaRuta(fecha, tramitadorId, ids)
  const agregados: number[] = []
  const rechazados = revision.filter(t => t.problema).map(t => ({ id: t.id, motivo: t.problema! }))

  for (const tramite of revision.filter(t => !t.problema)) {
    try {
      let avisarAsignado = false
      await db.transaction(async transaction => {
        const solicitud = await SolicitudTramites.findByPk(tramite.id, { transaction, lock: transaction.LOCK.UPDATE })
        if (!solicitud) throw new ErrorUbicacion('No existe', 404)

        // El aviso push al mensajero sale solo (hook del modelo) si cambia el tramitador
        const cambiaMensajero = Number(solicitud.tramitadorId) !== tramitadorId
        if (cambiaMensajero) await solicitud.update({ tramitadorId }, { transaction })

        // Misma regla de ProgramacionController: "asignado" si la fecha es nueva o posterior;
        // también si el trámite pasa a otro mensajero (es nuevo para él)
        const nuevaFecha = new Date(`${fecha}T00:00:00Z`)
        const programacion = await Programacion.findOne({ where: { solicitudTramiteId: tramite.id }, transaction })
        const fechaAnterior = programacion?.fechaProbableEntrega ?? null
        if (!programacion) {
          await Programacion.create({ solicitudTramiteId: tramite.id, fechaProbableEntrega: nuevaFecha }, { transaction })
        } else {
          await programacion.update({ fechaProbableEntrega: nuevaFecha }, { transaction })
        }
        avisarAsignado = cambiaMensajero || !fechaAnterior || nuevaFecha.getTime() > new Date(fechaAnterior).getTime()
      })

      agregados.push(tramite.id)
      // Los avisos nunca frenan el cambio ya guardado
      await notificarProgramacion(tramite.id, { avisarAsignado }).catch(error =>
        console.error(`❌ Avisos de programación del trámite ${tramite.id}:`, error))
    } catch (error) {
      rechazados.push({ id: tramite.id, motivo: error instanceof ErrorUbicacion ? error.message : 'No se pudo agregar' })
      if (!(error instanceof ErrorUbicacion)) console.error(`❌ Agregar el trámite ${tramite.id} a la ruta:`, error)
    }
  }

  return { agregados, rechazados }
}
