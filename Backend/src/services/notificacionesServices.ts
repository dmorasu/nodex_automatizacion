import { notificationQueue } from '../queues/notificacionesQueues'
import Notificacion from '../models/notificaciones'
import { generarPdfDocumentosSolicitud } from './generarDocumentosPDFSolicitudes'
import {
  construirMensaje,
  TipoNotificacion
} from './template/notificacionesPlantilla'


// =====================================
// CONFIGURACIÓN
// =====================================

const LINK_TORRE_CONTROL = 'https://wa.me/573166507738'

const CC_NOVEDADES_VEHICULOS = 'novedadesvehiculos@gomezpinedaabogados.com'
const OPERACION_VEHICULOS_ID = 9

const MAX_LARGO_DETALLE = 200

// SIDs de Twilio Content Templates (deben estar aprobados en WhatsApp)
const TEMPLATES_WHATSAPP = {
  ASIGNADO_CON_PDF: 'HXa99c54a116f11a8c1fac4158feefb40d',
  ASIGNADO_SIN_PDF: 'HXf9d1720fe95164674fdcf0a016a811da',
  DESISTIDO: 'HXdc84769685d853246741b746ec42474d',
  DILIGENCIA_HOY: 'HX5124a3f392efb6f07b8b4ed22786b9ec',
  DILIGENCIA_VENCIDA: 'HX19c7d166aed5ea4034962cdb2a6da75d'
}

const TIPOS_EMAIL: TipoNotificacion[] = [
  'FINALIZADO',
  'EN_ESPERA_POR_NOVEDAD',
  'PROGRAMACION',
  'TRAZABILIDAD',
  'LOGISTICA'
]


// =====================================
// TIPOS
// =====================================

type NotificacionParams = {
  solicitud: any
  tipo: TipoNotificacion
  destinatario: any
  data?: any
}

type MensajeWhatsapp = {
  templateSid: string
  variables: Record<string, string>
}

type ConstructorWhatsapp = (
  solicitud: any,
  data: any
) => MensajeWhatsapp | Promise<MensajeWhatsapp>


// =====================================
// UTILIDADES
// =====================================

// Twilio rechaza variables vacías, con saltos de línea o muchos espacios seguidos
const limpiar = (valor: unknown): string => {
  const texto = String(valor ?? '')
    .replace(/\r?\n|\r|\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return texto || 'N/A'
}

// Recorta a `max` caracteres sin partir palabras: corta en el último espacio antes del límite
const recortarEnPalabra = (texto: string, max: number): string => {
  if (texto.length <= max) return texto

  const ultimoEspacio = texto.lastIndexOf(' ', max)

  // Si no hay espacios (una sola palabra muy larga) se corta en el límite
  return ultimoEspacio > 0
    ? texto.slice(0, ultimoEspacio)
    : texto.slice(0, max)
}

// Detalle de la solicitud limpio y recortado, usando el de `data` o el de la solicitud
const obtenerDetalle = (solicitud: any, data: any): string =>
  recortarEnPalabra(
    limpiar(data.detalle || solicitud.detalleSolicitud),
    MAX_LARGO_DETALLE
  )

// Convierte ['a', 'b'] en { "1": "a", "2": "b" } para las variables {{n}} del template
const aVariables = (valores: unknown[]): Record<string, string> =>
  Object.fromEntries(
    valores.map((valor, i) => [String(i + 1), limpiar(valor)])
  )

const registrarNotificacion = async (
  solicitudId: number,
  tipo: TipoNotificacion,
  canal: 'WHATSAPP' | 'EMAIL',
  destinatario: string,
  mensaje: string
): Promise<number> => {
  const notif = await Notificacion.create({
    solicitudTramiteId: solicitudId,
    tipo,
    canal,
    destinatario,
    mensaje,
    estado: 'PENDIENTE'
  })

  return notif.getDataValue('id')
}

const obtenerPdfDocumentos = async (
  solicitudId: number
): Promise<string | undefined> => {
  try {
    const pdf = await generarPdfDocumentosSolicitud(solicitudId)

    if (!pdf) return undefined

    console.log(
      `📎 PDF generado: ${pdf.totalDocumentos} documentos, ${pdf.totalPaginas} páginas`
    )

    return pdf.mediaUrl
  } catch (error) {
    console.error('⚠️ No se pudo generar el PDF:', error)
    return undefined
  }
}


// =====================================
// TEMPLATES WHATSAPP POR TIPO
// El orden del arreglo = orden de las variables {{1}}, {{2}}, ...
// =====================================

const CONSTRUCTORES_WHATSAPP: Partial<Record<TipoNotificacion, ConstructorWhatsapp>> = {

  ASIGNADO: async (solicitud, data) => {
    const mediaUrl = await obtenerPdfDocumentos(solicitud.id)

    const valores = [
      data.nombre,
      data.numeroTramite || solicitud.id,
      data.tipoTramite,
      obtenerDetalle(solicitud, data),
      data.ubicacion,
      data.mueble,
      data.cliente,
      data.tarifa ?? 'N/A',
      data.fecha,
      data.programador,
      data.solicitante,
      LINK_TORRE_CONTROL
    ]

    if (mediaUrl) valores.push(mediaUrl)

    return {
      templateSid: mediaUrl
        ? TEMPLATES_WHATSAPP.ASIGNADO_CON_PDF
        : TEMPLATES_WHATSAPP.ASIGNADO_SIN_PDF,
      variables: aVariables(valores)
    }
  },

  DESISTIDO: (solicitud, data) => ({
    templateSid: TEMPLATES_WHATSAPP.DESISTIDO,
    variables: aVariables([
      data.nombre,
      data.tipoTramite,
      data.mueble,
      solicitud.clientes?.nombreCliente,
      solicitud.id,
      data.programador,
      LINK_TORRE_CONTROL
    ])
  }),

  DILIGENCIA_HOY: (solicitud, data) => ({
    templateSid: TEMPLATES_WHATSAPP.DILIGENCIA_HOY,
    variables: aVariables([
      data.nombre,
      data.tipo,
      obtenerDetalle(solicitud, data),
      data.mueble,
      data.ubicacion,
      solicitud.id,
      data.programador,
      LINK_TORRE_CONTROL
    ])
  }),

  DILIGENCIA_VENCIDA: (solicitud, data) => ({
    templateSid: TEMPLATES_WHATSAPP.DILIGENCIA_VENCIDA,
    variables: aVariables([
      data.nombre,
      data.tipo,
      obtenerDetalle(solicitud, data),
      data.mueble,
      data.ubicacion,
      solicitud.id,
      data.fecha,
      data.programador,
      LINK_TORRE_CONTROL
    ])
  })
}


// =====================================
// ENVÍO POR CANAL
// =====================================

const enviarWhatsapp = async (
  constructor: ConstructorWhatsapp,
  { solicitud, tipo, destinatario, data }: Required<NotificacionParams>,
  texto: string
) => {
  const telefono = destinatario?.numeroTramitador

  if (!telefono) {
    console.log(`❌ ${tipo}: sin número de tramitador (solicitud ${solicitud.id})`)
    return
  }

  const { templateSid, variables } = await constructor(solicitud, data)

  const notificacionId = await registrarNotificacion(
    solicitud.id,
    tipo,
    'WHATSAPP',
    telefono,
    texto
  )

  const job = await notificationQueue.add('send', {
    notificacionId,
    solicitudTramiteId: solicitud.id,
    canal: 'WHATSAPP',
    to: telefono,
    templateSid,
    variables
  })

  console.log(
    `📥 WhatsApp ${tipo} en cola (solicitud ${solicitud.id}, notificación ${notificacionId}, job ${job.id}, template ${templateSid})`
  )
}

const enviarEmail = async (
  { solicitud, tipo, destinatario }: Required<NotificacionParams>,
  subject: string,
  html: string
) => {
  const correo = destinatario?.correoUsuario

  if (!correo) {
    console.log(`❌ ${tipo}: sin correo de usuario (solicitud ${solicitud.id})`)
    return
  }

  const cc: string[] = []

  if (
    tipo === 'EN_ESPERA_POR_NOVEDAD' &&
    Number(solicitud.operacionesId) === OPERACION_VEHICULOS_ID
  ) {
    cc.push(CC_NOVEDADES_VEHICULOS)
  }

  const notificacionId = await registrarNotificacion(
    solicitud.id,
    tipo,
    'EMAIL',
    correo,
    html
  )

  const job = await notificationQueue.add('send', {
    notificacionId,
    canal: 'EMAIL',
    to: correo,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    message: html
  })

  console.log(
    `📧 Email ${tipo} en cola (solicitud ${solicitud.id}, notificación ${notificacionId}, job ${job.id}, asunto "${subject}")`
  )
}


// =====================================
// PUNTO DE ENTRADA
// =====================================

export const crearNotificacion = async ({
  solicitud,
  tipo,
  destinatario,
  data = {}
}: NotificacionParams) => {

  const params = { solicitud, tipo, destinatario, data }

  const { subject, text, html } = construirMensaje(tipo, solicitud, data)

  const constructorWhatsapp = CONSTRUCTORES_WHATSAPP[tipo]

  if (constructorWhatsapp) {
    return enviarWhatsapp(constructorWhatsapp, params, text)
  }

  if (TIPOS_EMAIL.includes(tipo)) {
    return enviarEmail(params, subject, html)
  }

  console.warn(`⚠️ Tipo de notificación no manejado: ${tipo}`)
}
