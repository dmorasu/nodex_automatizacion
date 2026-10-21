import { db } from '../config/db'
import { notificationQueue } from '../queues/notificacionesQueues'
import Notificacion from '../models/notificaciones'
import SolicitudTramites from '../models/solicitudTramites'
import EstadosTramites from '../models/estadosTramites'
import TiposRechazo from '../models/tiposRechazos'
import Trazabilidad from '../models/trazabilidad'
import Usuarios from '../models/usuarios'
import Tramite from '../models/tramite'
import Clientes from '../models/clientes'
import Municipios from '../models/municipios'
import { ErrorEstadoTramite, ESTADO_EN_ESPERA_POR_NOVEDAD, ESTADO_NOVEDAD_SUBSANADA, registrarEstado, validarFechaEntrega } from './estadoTramite'
import { correoBase, ficha, html, MARCAS, nota } from './template/correoBase'

// =====================================
// NOVEDAD SUBSANADA (la marca quien creó el trámite)
// Cuando Torre de control pone el trámite "En espera por novedad", quien lo creó corrige lo que
// faltaba y lo marca como "Novedad Subsanada Continuar Trámite". Es el único cambio de estado que
// puede hacer el creador. Debe decir qué subsanó (queda como trazabilidad) y poner otra vez la
// fecha de entrega del resultado; la anterior queda en el historial del trámite. Se avisa por
// correo al analista asignado con copia a la torre de control (sin analista: a la torre de control).
// =====================================

export class ErrorNovedadSubsanada extends ErrorEstadoTramite {}

const correoTorreControl = () => process.env.CORREO_TORRE_CONTROL || 'torredecontrol@gomezpinedaabogados.com'

// YYYY-MM-DD → DD/MM/YYYY
const fechaTexto = (fecha: string | null) => (fecha ? fecha.split('-').reverse().join('/') : 'Sin fecha')

// La fecha de entrega se guarda a medianoche UTC, como la guarda el formulario del trámite
const fechaDeEntrega = (valor: Date | string | null) =>
  valor ? new Date(valor).toISOString().slice(0, 10) : null

export type DatosSubsanacion = {
  solicitudTramiteId: number
  usuario: { id: number, nombreUsuario: string }
  // Quien lo marca y los de su área (el trámite debe haberlo creado uno de ellos)
  usuariosDelArea: number[]
  fechaEntregaResultado: string   // YYYY-MM-DD
  observacion: string
}

export const subsanarNovedad = async ({ solicitudTramiteId, usuario, usuariosDelArea, fechaEntregaResultado, observacion }: DatosSubsanacion) => {
  const texto = observacion?.trim() ?? ''
  if (!texto) throw new ErrorNovedadSubsanada('Escriba qué se subsanó')
  const fechaNueva = validarFechaEntrega(fechaEntregaResultado)

  const { fechaAnterior } = await db.transaction(async transaction => {
    // Bloqueo de la fila: dos clics seguidos no registran dos veces la subsanación
    const solicitud = await SolicitudTramites.findByPk(solicitudTramiteId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!solicitud) throw new ErrorNovedadSubsanada('El trámite no existe', 404)
    if (!usuariosDelArea.includes(solicitud.usuarioId)) {
      throw new ErrorNovedadSubsanada('Solo quien creó el trámite o alguien de su área puede marcar la novedad como subsanada', 403)
    }
    if (Number(solicitud.get('estadoActualTramite')) !== ESTADO_EN_ESPERA_POR_NOVEDAD) {
      throw new ErrorNovedadSubsanada('El trámite no está en espera por novedad', 409)
    }

    const fechaAnterior = fechaDeEntrega(solicitud.fechaEntregaResultado)
    await Trazabilidad.create({
      solicitudTramiteId,
      observacionTrazabilidad: `Novedad subsanada: ${texto}`,
      nombreUsuario: usuario.nombreUsuario
    }, { transaction })
    // Cambia también la fecha de entrega (el historial guarda la anterior y la nueva)
    await registrarEstado({ solicitudTramiteId, estadoId: ESTADO_NOVEDAD_SUBSANADA, fechaEntregaResultado: fechaNueva }, transaction)

    return { fechaAnterior }
  })

  // Después de guardar: un fallo del correo no deshace la subsanación
  await notificarNovedadSubsanada(solicitudTramiteId, usuario.nombreUsuario, texto, fechaAnterior, fechaNueva)
}

const notificarNovedadSubsanada = async (
  solicitudTramiteId: number,
  creador: string,
  observacion: string,
  fechaAnterior: string | null,
  fechaNueva: string
) => {
  try {
    const [tramite, novedad] = await Promise.all([
      SolicitudTramites.findByPk(solicitudTramiteId, {
        attributes: ['id', 'placa', 'matriculaInmobiliaria', 'analistaAsignado'],
        include: [
          { model: Tramite, attributes: ['nombreTramite'] },
          { model: Clientes, attributes: ['nombreCliente'] },
          { model: Municipios, attributes: ['nombreMunicipio'] }
        ]
      }),
      // La novedad que se subsanó: el último "En espera por novedad" con su tipo de rechazo
      EstadosTramites.findOne({
        where: { solicitudTramiteId, estadoId: ESTADO_EN_ESPERA_POR_NOVEDAD },
        include: [{ model: TiposRechazo, attributes: ['nombre'] }],
        order: [['createdAt', 'DESC']]
      })
    ])
    if (!tramite) return

    const analista = tramite.analistaAsignado
      ? await Usuarios.findByPk(tramite.analistaAsignado, { attributes: ['nombreUsuario', 'correoUsuario'] })
      : null
    const conAnalista = Boolean(analista?.correoUsuario)

    const urlBase = process.env.URL_NODEX_TRAMITES?.replace(/\/+$/, '')
    const mensaje = correoBase({
      marca: MARCAS.TRAMITES,
      estado: { texto: 'Novedad subsanada', tono: 'exito' },
      titulo: `${creador} subsanó la novedad del trámite #${tramite.id}`,
      saludo: conAnalista ? `Hola <strong>${html(analista!.nombreUsuario)}</strong>,` : 'Hola Torre de Control,',
      intro: `El trámite${conAnalista ? ', que tienes asignado,' : ' (sin analista asignado)'} pasó a "Novedad Subsanada Continuar Trámite" y puede seguir su curso.`,
      cuerpo: ficha({
        titulo: `Trámite #${tramite.id}`,
        subtitulo: html(tramite.placa || tramite.matriculaInmobiliaria || ''),
        detalles: [
          ['Tipo de trámite', html(tramite.tramite?.nombreTramite ?? '')],
          ['Cliente', html(tramite.clientes?.nombreCliente ?? '')],
          ['Municipio', html(tramite.municipios?.nombreMunicipio ?? '')],
          ['Novedad', html(novedad?.tipoRechazo?.nombre ?? '')],
          ['Subsanada por', html(creador)],
          ['Nueva entrega del resultado', fechaTexto(fechaNueva)],
          ['Entrega anterior', fechaTexto(fechaAnterior)]
        ]
      }) + nota('exito', html(observacion).replace(/\n/g, '<br>'), 'Qué se subsanó'),
      boton: { texto: 'Ver el trámite', url: urlBase ? `${urlBase}/center/solicitudTramites/${tramite.id}` : undefined }
    })

    const to = conAnalista ? analista!.correoUsuario : correoTorreControl()
    const notificacion = await Notificacion.create({
      solicitudTramiteId, tipo: 'NOVEDAD_SUBSANADA', canal: 'EMAIL', destinatario: to, mensaje, estado: 'PENDIENTE'
    })
    await notificationQueue.add('send', {
      notificacionId: notificacion.id,
      canal: 'EMAIL',
      to,
      subject: `Novedad subsanada · Trámite #${tramite.id}`,
      message: mensaje,
      // Copia a la torre de control solo cuando va al analista
      ccTorreControl: conAnalista
    })
  } catch (error) {
    console.error(`⚠️ Novedad subsanada guardada, pero falló el correo (trámite ${solicitudTramiteId}):`, error)
  }
}
