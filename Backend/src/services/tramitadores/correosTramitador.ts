import { notificationQueue } from '../../queues/notificacionesQueues'
import Notificacion from '../../models/notificaciones'
import SolicitudTramites from '../../models/solicitudTramites'
import Tramite from '../../models/tramite'
import Clientes from '../../models/clientes'
import Municipios from '../../models/municipios'
import Estados from '../../models/estados'
import Tramitador from '../../models/tramitador'
import Usuarios from '../../models/usuarios'
import { correoBase, ficha, html, MARCAS, nota, type Detalle, type Tono } from '../template/correoBase'

// =====================================
// CORREOS DE LO QUE HACE EL TRAMITADOR EN LA APP
// Cada operación (comentario, documentos, reporte de realizado, soporte de un gasto) avisa al
// analista asignado al trámite con copia a la torre de control; si el trámite no tiene analista
// (o el analista no tiene correo), o el gasto no tiene trámite, va directo a la torre de control.
// Se llaman después de guardar y nunca lanzan: un correo no debe frenar al tramitador.
// =====================================

const correoTorreControl = () => process.env.CORREO_TORRE_CONTROL || 'torredecontrol@gomezpinedaabogados.com'

export type OperacionTramitador =
  | { tipo: 'COMENTARIO', comentario: string }
  | { tipo: 'DOCUMENTOS', tipoDocumento: string, archivos: string[], gasto?: string | null }
  | { tipo: 'REALIZADO', observacion: string }
  | { tipo: 'SOPORTE_GASTO', tipoSoporte: string, gasto: string, archivos: string[], observacion?: string | null }

// Asunto, etiqueta, título y lo que se cuenta de cada operación
const CONTENIDO: Record<OperacionTramitador['tipo'], { tipoNotificacion: string, estado: string, asunto: string, tono: Tono, verbo: string }> = {
  COMENTARIO: { tipoNotificacion: 'TRAMITADOR_COMENTARIO', estado: 'Comentario', asunto: 'Comentario del tramitador', tono: 'info', verbo: 'escribió un comentario' },
  DOCUMENTOS: { tipoNotificacion: 'TRAMITADOR_DOCUMENTOS', estado: 'Documentos', asunto: 'Documentos del tramitador', tono: 'info', verbo: 'subió documentos' },
  REALIZADO: { tipoNotificacion: 'TRAMITADOR_REALIZADO', estado: 'Reportado como realizado', asunto: 'Reportado como realizado', tono: 'exito', verbo: 'reportó como realizado' },
  SOPORTE_GASTO: { tipoNotificacion: 'TRAMITADOR_SOPORTE_GASTO', estado: 'Soporte de gasto', asunto: 'Soporte de gasto del tramitador', tono: 'info', verbo: 'subió un soporte de gasto' }
}

const listaArchivos = (archivos: string[]) =>
  archivos.map(nombre => `• ${html(nombre)}`).join('<br>')

// Lo propio de cada operación: detalles de la ficha y la nota con el texto del tramitador
const detalleOperacion = (operacion: OperacionTramitador): { detalles: Detalle[], cuerpo: string } => {
  switch (operacion.tipo) {
    case 'COMENTARIO':
      return { detalles: [], cuerpo: nota('info', html(operacion.comentario).replace(/\n/g, '<br>'), 'Comentario') }
    case 'REALIZADO':
      return {
        detalles: [],
        cuerpo: nota('exito', html(operacion.observacion).replace(/\n/g, '<br>'), 'Observación') +
          nota('neutro', 'El estado del trámite no cambia: el reporte queda pendiente de revisión en "Reportados como realizados".')
      }
    case 'DOCUMENTOS':
      return {
        detalles: [['Tipo de documento', html(operacion.tipoDocumento)], ['Gasto', operacion.gasto ? html(operacion.gasto) : null]],
        cuerpo: nota('neutro', listaArchivos(operacion.archivos), operacion.archivos.length === 1 ? 'Archivo' : `${operacion.archivos.length} archivos`)
      }
    case 'SOPORTE_GASTO':
      return {
        detalles: [['Tipo de soporte', html(operacion.tipoSoporte)], ['Gasto', html(operacion.gasto)]],
        cuerpo: nota('neutro', listaArchivos(operacion.archivos), operacion.archivos.length === 1 ? 'Archivo' : `${operacion.archivos.length} archivos`) +
          (operacion.observacion ? nota('info', html(operacion.observacion), 'Observación') : '')
      }
  }
}

const encolar = async (tipo: string, solicitudTramiteId: number | null, to: string, subject: string, mensaje: string, ccTorreControl: boolean) => {
  const notificacion = await Notificacion.create({
    solicitudTramiteId, tipo, canal: 'EMAIL', destinatario: to, mensaje, estado: 'PENDIENTE'
  })
  await notificationQueue.add('send', {
    notificacionId: notificacion.id, canal: 'EMAIL', to, subject, message: mensaje, ccTorreControl
  })
}

export const notificarOperacionTramitador = async (
  solicitudTramiteId: number | null,
  tramitadorId: number,
  operacion: OperacionTramitador
) => {
  try {
    const [tramite, tramitador] = await Promise.all([
      solicitudTramiteId
        ? SolicitudTramites.findByPk(solicitudTramiteId, {
          attributes: ['id', 'placa', 'matriculaInmobiliaria', 'analistaAsignado'],
          include: [
            { model: Tramite, attributes: ['nombreTramite'] },
            { model: Clientes, attributes: ['nombreCliente'] },
            { model: Municipios, attributes: ['nombreMunicipio'] },
            { model: Estados, as: 'estadoActual', attributes: ['nombreEstado'] }
          ]
        })
        : null,
      Tramitador.findByPk(tramitadorId, { attributes: ['nombreTramitador'] })
    ])

    const analista = tramite?.analistaAsignado
      ? await Usuarios.findByPk(tramite.analistaAsignado, { attributes: ['nombreUsuario', 'correoUsuario'] })
      : null
    const conAnalista = Boolean(analista?.correoUsuario)

    const contenido = CONTENIDO[operacion.tipo]
    const nombreTramitador = tramitador?.nombreTramitador || `Tramitador ${tramitadorId}`
    const referencia = tramite ? `el trámite #${tramite.id}` : operacion.tipo === 'SOPORTE_GASTO' ? `el gasto ${operacion.gasto}` : 'un trámite'
    const { detalles, cuerpo } = detalleOperacion(operacion)

    const fichaTramite = ficha({
      titulo: tramite ? `Trámite #${tramite.id}` : undefined,
      subtitulo: tramite ? html(tramite.placa || tramite.matriculaInmobiliaria || '') : undefined,
      detalles: [
        ['Tramitador', html(nombreTramitador)],
        ['Tipo de trámite', html(tramite?.tramite?.nombreTramite ?? '')],
        ['Cliente', html(tramite?.clientes?.nombreCliente ?? '')],
        ['Municipio', html(tramite?.municipios?.nombreMunicipio ?? '')],
        ['Estado actual', html(tramite?.estadoActual?.nombreEstado ?? '')],
        ...detalles
      ]
    })

    const urlBase = process.env.URL_NODEX_TRAMITES?.replace(/\/+$/, '')
    const mensaje = correoBase({
      marca: MARCAS.TRAMITES,
      estado: { texto: contenido.estado, tono: contenido.tono },
      titulo: `${nombreTramitador} ${contenido.verbo}`,
      saludo: conAnalista ? `Hola <strong>${html(analista!.nombreUsuario)}</strong>,` : 'Hola Torre de Control,',
      intro: `Desde la app de tramitadores, en ${html(referencia)}${conAnalista ? ', que tienes asignado' : tramite ? ' (sin analista asignado)' : ''}.`,
      cuerpo: fichaTramite + cuerpo,
      boton: { texto: 'Ver el trámite', url: urlBase && tramite ? `${urlBase}/center/solicitudTramites/${tramite.id}` : urlBase }
    })

    const asunto = `${contenido.asunto} · ${tramite ? `Trámite #${tramite.id}` : operacion.tipo === 'SOPORTE_GASTO' ? operacion.gasto : ''}`
    await encolar(
      contenido.tipoNotificacion,
      tramite?.id ?? null,
      conAnalista ? analista!.correoUsuario : correoTorreControl(),
      asunto,
      mensaje,
      conAnalista // copia a la torre de control solo cuando va al analista
    )
  } catch (error) {
    console.error(`⚠️ No se pudo enviar el correo de la operación del tramitador (${operacion.tipo}):`, error)
  }
}
