import { db } from '../config/db'
import SolicitudTramites from '../models/solicitudTramites'
import EstadosTramites from '../models/estadosTramites'
import Programacion from '../models/programacion'
import Estados from '../models/estados'
import Usuarios from '../models/usuarios'
import Tramitador from '../models/tramitador'
import Trazabilidad from '../models/trazabilidad'
import Municipios from '../models/municipios'
import Operaciones from '../models/operaciones'
import TiposRechazo from '../models/tiposRechazos'
import Tramite from '../models/tramite'
import Clientes from '../models/clientes'
import { crearNotificacion } from './notificacionesServices'
import { fechaColombia } from '../utils/fechaColombia'

// =====================================
// CAMBIO DE ESTADO DE UN TRÁMITE
// Una sola lógica para el cambio individual, el cargue por Excel y la gestión masiva en pantalla:
//   · registra el estado y actualiza el estado actual de la solicitud
//   · Finalizado: marca la fecha de finalización en la programación
//   · notifica: Desistido (WhatsApp al tramitador), En espera por novedad y Finalizado (correo)
// =====================================

const ESTADO_EN_ESPERA_POR_NOVEDAD = 3
const ESTADO_DESISTIDO = 5
const ESTADO_FINALIZADO = 6

export type CambioEstado = {
  solicitudTramiteId: number
  estadoId: number
  tipoRechazoId?: number | null
}

export const cambiarEstadoTramite = async ({ solicitudTramiteId, estadoId, tipoRechazoId }: CambioEstado) => {
  const estadoNumero = Number(estadoId)

  // ── 1. Guardar (en una transacción) ──────────────
  const { registro, solicitud, esFinalizado } = await db.transaction(async transaction => {
    const registro = await EstadosTramites.create({
      solicitudTramiteId,
      estadoId: estadoNumero,
      tipoRechazoId: tipoRechazoId || null
    }, { transaction })

    await SolicitudTramites.update(
      { estadoActualTramite: estadoNumero },
      { where: { id: solicitudTramiteId }, transaction }
    )

    const estado = await Estados.findByPk(estadoNumero, { transaction })
    const esFinalizado = estadoNumero === ESTADO_FINALIZADO
      || estado?.nombreEstado?.toLowerCase().trim() === 'finalizado'

    const solicitud = await SolicitudTramites.findByPk(solicitudTramiteId, {
      include: [Usuarios, Tramitador, Municipios, Operaciones, Tramite, Clientes],
      transaction
    })
    if (!solicitud) throw new Error('No se encontró la solicitud del trámite')

    if (esFinalizado) {
      const programacion = await Programacion.findOne({ where: { solicitudTramiteId }, transaction })
      if (programacion) await programacion.update({ fechaFinalizacionServicio: new Date() }, { transaction })
      else await Programacion.create({ solicitudTramiteId, fechaFinalizacionServicio: new Date() }, { transaction })
    }

    return { registro, solicitud, esFinalizado }
  })

  // ── 2. Notificaciones (después de confirmar; un fallo aquí no deshace el cambio) ──
  try {
    if (estadoNumero === ESTADO_DESISTIDO && solicitud.tramitador) {
      await crearNotificacion({
        solicitud,
        tipo: 'DESISTIDO',
        destinatario: solicitud.tramitador,
        data: {
          nombre: solicitud.tramitador?.nombreTramitador || 'N/A',
          tipoTramite: solicitud.tramite?.nombreTramite || 'N/A',
          mueble: solicitud.placa || solicitud.matriculaInmobiliaria || 'N/A',
          programador: solicitud.municipios?.responsable || 'N/A'
        }
      })
    }

    const necesitaContexto = (estadoNumero === ESTADO_EN_ESPERA_POR_NOVEDAD || esFinalizado) && solicitud.usuario
    if (necesitaContexto) {
      const [estadoConRechazo, ultimaTrazabilidad] = await Promise.all([
        EstadosTramites.findByPk(registro.id, { include: [TiposRechazo] }),
        Trazabilidad.findOne({ where: { solicitudTramiteId }, order: [['createdAt', 'DESC']] })
      ])

      if (estadoNumero === ESTADO_EN_ESPERA_POR_NOVEDAD) {
        await crearNotificacion({
          solicitud,
          tipo: 'EN_ESPERA_POR_NOVEDAD',
          destinatario: solicitud.usuario,
          data: {
            estadoId: estadoNumero,
            nombre: solicitud.usuario.nombreUsuario,
            tipo: solicitud.tramite?.nombreTramite || 'N/A',
            novedad: ultimaTrazabilidad?.observacionTrazabilidad || 'Sin observaciones',
            tipoRechazo: estadoConRechazo?.tipoRechazo?.nombre || 'Sin tipo de rechazo',
            tramitador: solicitud.municipios?.responsable || 'N/A',
            municipio: solicitud.municipios?.nombreMunicipio || 'N/A',
            programador: solicitud.municipios?.responsable || 'N/A',
            operacion: solicitud.operaciones?.nombreOperacion || 'N/A'
          }
        })
      }

      if (esFinalizado) {
        await crearNotificacion({
          solicitud,
          tipo: 'FINALIZADO',
          destinatario: solicitud.usuario,
          data: {
            nombre: solicitud.usuario.nombreUsuario,
            fecha: fechaColombia(),
            tramitador: solicitud.tramitador?.nombreTramitador || 'N/A',
            municipio: solicitud.municipios?.nombreMunicipio || 'N/A',
            operacion: solicitud.operaciones?.nombreOperacion || 'N/A',
            tipo: solicitud.tramite?.nombreTramite || 'N/A',
            programador: solicitud.municipios?.responsable || 'N/A',
            resultado: ultimaTrazabilidad?.observacionTrazabilidad || 'Sin observaciones'
          }
        })
      }
    }
  } catch (error) {
    console.error(`⚠️ Estado guardado, pero falló una notificación (solicitud ${solicitudTramiteId}):`, error)
  }

  return { esFinalizado }
}
