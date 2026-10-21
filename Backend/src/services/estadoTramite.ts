import type { Transaction } from 'sequelize'
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
import { notificarFacturasParaLegalizacion } from './gastos/notificacionesGastos'

// =====================================
// CAMBIO DE ESTADO DE UN TRÁMITE
// Una sola lógica para el cambio individual, el cargue por Excel y la gestión masiva en pantalla:
//   · registra el estado y actualiza el estado actual de la solicitud
//   · Finalizado: marca la fecha de finalización en la programación
//   · notifica: Desistido (WhatsApp al tramitador y correo a quien creó el trámite),
//     En espera por novedad y Finalizado (correo)
//   · Novedad Subsanada Continuar Trámite exige una nueva fecha de entrega del resultado; la
//     anterior queda en el historial del trámite (anterior → nueva, con quién la cambió)
// =====================================

export const ESTADO_EN_ESPERA_POR_NOVEDAD = 3
export const ESTADO_NOVEDAD_SUBSANADA = 4
const ESTADO_DESISTIDO = 5
const ESTADO_FINALIZADO = 6

export type CambioEstado = {
  solicitudTramiteId: number
  estadoId: number
  tipoRechazoId?: number | null
  // Obligatoria con Novedad Subsanada Continuar Trámite (YYYY-MM-DD o DD/MM/YYYY)
  fechaEntregaResultado?: string | null
}

// Error de datos del cambio de estado (se responde con su status, no como error del servidor)
export class ErrorEstadoTramite extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const hoyColombia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

// Nueva fecha de entrega del resultado → YYYY-MM-DD. Acepta también DD/MM/YYYY (Excel escrito a mano).
export const validarFechaEntrega = (valor: string | null | undefined) => {
  const texto = String(valor ?? '').trim()
  const dma = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const fecha = dma ? `${dma[3]}-${dma[2].padStart(2, '0')}-${dma[1].padStart(2, '0')}` : texto.slice(0, 10)
  if (!fecha) throw new ErrorEstadoTramite('Indique la nueva fecha de entrega del resultado')
  const enUtc = new Date(`${fecha}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(enUtc.getTime()) || enUtc.toISOString().slice(0, 10) !== fecha) {
    throw new ErrorEstadoTramite('La fecha de entrega del resultado no es válida')
  }
  if (fecha < hoyColombia()) throw new ErrorEstadoTramite('La fecha de entrega del resultado no puede ser anterior a hoy')
  return fecha
}

// Guarda el estado dentro de la transacción que se le pase (para quien necesite cambiar el
// estado junto con otros datos, como la novedad subsanada). Sin notificaciones.
export const registrarEstado = async ({ solicitudTramiteId, estadoId, tipoRechazoId, fechaEntregaResultado }: CambioEstado, transaction: Transaction) => {
  const estadoNumero = Number(estadoId)

  // Novedad subsanada: nueva fecha de entrega. Se cambia con el modelo (no con un update en
  // bloque) para que el historial guarde la fecha anterior y la nueva con el usuario
  if (estadoNumero === ESTADO_NOVEDAD_SUBSANADA) {
    const fecha = validarFechaEntrega(fechaEntregaResultado)
    const tramite = await SolicitudTramites.findByPk(solicitudTramiteId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!tramite) throw new ErrorEstadoTramite('El trámite no existe', 404)
    // A medianoche UTC, como la guarda el formulario del trámite
    await tramite.update({ fechaEntregaResultado: new Date(`${fecha}T00:00:00Z`) }, { transaction })
  }

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
}

export const cambiarEstadoTramite = async (cambio: CambioEstado) => {
  const { solicitudTramiteId } = cambio
  const estadoNumero = Number(cambio.estadoId)

  // ── 1. Guardar (en una transacción) ──────────────
  const { registro, solicitud, esFinalizado } = await db.transaction(transaction => registrarEstado(cambio, transaction))

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

    const esDesistido = estadoNumero === ESTADO_DESISTIDO
    const necesitaContexto = (estadoNumero === ESTADO_EN_ESPERA_POR_NOVEDAD || esFinalizado || esDesistido) && solicitud.usuario
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

      if (esDesistido) {
        await crearNotificacion({
          solicitud,
          tipo: 'DESISTIDO_SOLICITANTE',
          destinatario: solicitud.usuario,
          data: {
            nombre: solicitud.usuario.nombreUsuario,
            tipo: solicitud.tramite?.nombreTramite,
            cliente: solicitud.clientes?.nombreCliente,
            municipio: solicitud.municipios?.nombreMunicipio,
            operacion: solicitud.operaciones?.nombreOperacion,
            tramitador: solicitud.tramitador?.nombreTramitador,
            fecha: fechaColombia(),
            motivo: ultimaTrazabilidad?.observacionTrazabilidad
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

  // Gastos del trámite con factura del tramitador → Legalización (no depende de que el trámite tenga creador)
  if (esFinalizado) await notificarFacturasParaLegalizacion(solicitudTramiteId)

  return { esFinalizado }
}
