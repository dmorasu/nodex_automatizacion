import webpush, { WebPushError } from 'web-push'
import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import SuscripcionPush from '../../models/tramitadores/suscripcionPush'
import SolicitudTramites from '../../models/solicitudTramites'
import Tramite from '../../models/tramite'
import Municipios from '../../models/municipios'
import Usuarios from '../../models/usuarios'
import { ESTADOS_GASTO, ESTADOS_REINTEGRO } from '../gastos/constantes'
import { ESTADOS_SOPORTE, TIPOS_SOPORTE } from '../../models/tramitadores/soporteTramitador'
import { ErrorGastos as ErrorNegocio } from '../gastos/errores'

// =====================================
// NOTIFICACIONES PUSH DE LA APP NODEX TRAMITADORES
// El tramitador las activa en su celular (la app guarda la suscripción) y llegan aunque la
// app esté cerrada. Sin claves VAPID en el .env no se envía nada (y la app no ofrece activarlas).
// A diferencia del WhatsApp, también salen en modo ensayo: solo llegan a los celulares que
// las activaron en la app de ese ambiente.
// =====================================

type Aviso = {
  titulo: string
  cuerpo: string
  // Ruta de la app que se abre al tocar la notificación (ej: /tramites/123)
  url: string
  // Notificaciones con la misma etiqueta se reemplazan en el celular en lugar de acumularse
  etiqueta?: string
}

// Las claves se leen al usar (no al cargar el módulo) para no depender del orden de dotenv
const configuracion = () => {
  const publica = process.env.VAPID_PUBLIC_KEY?.trim()
  const privada = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publica || !privada) return null
  return { publica, privada, contacto: process.env.VAPID_CONTACTO?.trim() || 'https://tramitadores.nodexgpa.com' }
}

export const clavePublicaPush = () => configuracion()?.publica ?? null

// ── Suscripciones (las maneja la app) ──

type DatosSuscripcion = { endpoint: string, keys: { p256dh: string, auth: string } }

export const guardarSuscripcion = async (tramitadorId: number, datos: DatosSuscripcion, navegador: string | null) => {
  if (!configuracion()) throw new ErrorNegocio('Las notificaciones no están disponibles por ahora', 503)

  // El endpoint es del celular: si ya existía (otro tramitador en el mismo celular, o claves
  // renovadas por el navegador), se actualiza
  const valores = {
    tramitadorId,
    endpoint: datos.endpoint,
    p256dh: datos.keys.p256dh,
    auth: datos.keys.auth,
    navegador: navegador?.slice(0, 300) || null
  }
  const existente = await SuscripcionPush.findOne({ where: { endpoint: datos.endpoint } })
  if (existente) await existente.update(valores)
  else await SuscripcionPush.create(valores)
}

export const quitarSuscripcion = (tramitadorId: number, endpoint: string) =>
  SuscripcionPush.destroy({ where: { tramitadorId, endpoint } })

// ── Envío ──

// Envía el aviso a todos los celulares del tramitador. Devuelve a cuántos llegó
// (0 si no tiene notificaciones activadas). Nunca lanza: un aviso no debe frenar el proceso.
export const enviarAvisoTramitador = async (tramitadorId: number, aviso: Aviso) => {
  const config = configuracion()
  if (!config) return 0

  const suscripciones = await SuscripcionPush.findAll({ where: { tramitadorId } })
  const contenido = JSON.stringify(aviso)
  let enviados = 0

  await Promise.all(suscripciones.map(async suscripcion => {
    try {
      await webpush.sendNotification(
        { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
        contenido,
        {
          vapidDetails: { subject: config.contacto, publicKey: config.publica, privateKey: config.privada },
          // Si el celular está apagado, el servicio de push guarda el aviso hasta 1 día
          TTL: 24 * 60 * 60,
          urgency: 'high'
        }
      )
      enviados++
    } catch (error) {
      // 404/410: el tramitador desactivó las notificaciones, borró los datos o desinstaló la app
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        await suscripcion.destroy().catch(() => undefined)
      } else {
        console.error(`❌ Push al tramitador ${tramitadorId}:`, error instanceof Error ? error.message : error)
      }
    }
  }))

  return enviados
}

// ── Trámite asignado ──

// La llama el modelo SolicitudTramites cada vez que cambia su tramitador (crear, editar,
// asignar o gestión masiva), así no depende de que cada pantalla se acuerde de avisar
export const avisarTramiteAsignado = async (solicitudTramiteId: number, tramitadorId: number) => {
  try {
    if (!configuracion()) return
    const tramite = await SolicitudTramites.findByPk(solicitudTramiteId, {
      attributes: ['id', 'placa', 'matriculaInmobiliaria', 'direccionTramite'],
      include: [
        { model: Tramite, attributes: ['nombreTramite'] },
        { model: Municipios, attributes: ['nombreMunicipio'] }
      ]
    })
    if (!tramite) return

    const detalle = [
      tramite.tramite?.nombreTramite,
      tramite.placa || tramite.matriculaInmobiliaria,
      tramite.municipios?.nombreMunicipio
    ].filter(Boolean).join(' · ')

    await enviarAvisoTramitador(tramitadorId, {
      titulo: `Nuevo trámite asignado #${tramite.id}`,
      cuerpo: detalle || 'Toque para ver el detalle',
      url: `/tramites/${tramite.id}`,
      etiqueta: `tramite-${tramite.id}`
    })
  } catch (error) {
    console.error(`❌ Push de trámite asignado (${solicitudTramiteId}):`, error)
  }
}

// ── Mensaje del equipo en la pestaña Tramitador ──

// Se llama después de guardar el comentario; si el trámite no tiene tramitador no avisa a nadie.
// Los mensajes de un mismo trámite comparten etiqueta: el celular muestra el último y vuelve a sonar.
export const avisarComentarioEquipo = async (solicitudTramiteId: number, usuarioId: number, comentario: string) => {
  try {
    if (!configuracion()) return
    const [tramite, usuario] = await Promise.all([
      SolicitudTramites.findByPk(solicitudTramiteId, { attributes: ['id', 'tramitadorId'] }),
      Usuarios.findByPk(usuarioId, { attributes: ['nombreUsuario'] })
    ])
    if (!tramite?.tramitadorId) return

    const texto = comentario.trim()
    const autor = usuario?.nombreUsuario?.trim() || 'Nodex Trámites'
    await enviarAvisoTramitador(Number(tramite.tramitadorId), {
      titulo: `Mensaje sobre el trámite #${tramite.id}`,
      cuerpo: `${autor}: ${texto.length > 140 ? `${texto.slice(0, 140)}…` : texto}`,
      url: `/tramites/${tramite.id}`,
      etiqueta: `comentario-${tramite.id}`
    })
  } catch (error) {
    console.error(`❌ Push de comentario (${solicitudTramiteId}):`, error)
  }
}

// ── Recordatorio diario de reintegros ──

const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)

// Reintegros PENDIENTES que el tramitador todavía no ha enviado: sin comprobante, o con el
// último rechazado (debe subir otro). Los que tienen un comprobante pendiente de revisión
// ya están en manos de Legalización y no se recuerdan.
// Mismo criterio de "gasto del tramitador" que la app (soportesTramitador.ts).
// Solo tramitadores activos que siguen teniendo acceso a la app.
const consultarReintegrosPorEnviar = () =>
  db.query<{ tramitadorId: number, cantidad: string, valor: string, suscripciones: string }>(`
    SELECT
      tr.id AS "tramitadorId",
      COUNT(*) AS cantidad,
      SUM(r.valor_reintegro) AS valor,
      (SELECT COUNT(*) FROM tramitadores_suscripciones_push sp WHERE sp.tramitador_id = tr.id) AS suscripciones
    FROM gastos_reintegros r
    JOIN gastos_estados_reintegro er ON er.id = r.estado_id AND er.codigo = :reintegroPendiente
    JOIN gastos_solicitudes g ON g.id = r.solicitud_gasto_id
    JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo NOT IN (:sinPago)
    LEFT JOIN "SolicitudTramites" t ON t.id = g.solicitud_tramite_id
    JOIN "Tramitador" tr ON tr.id = COALESCE(g.tramitador_id, t."tramitadorId") AND tr.activo = true
    JOIN tramitadores_acceso a ON a.tramitador_id = tr.id
    WHERE NOT EXISTS (
      SELECT 1 FROM tramitadores_soportes s
      WHERE s.reintegro_id = r.id AND s.tipo = :tipoReintegro AND s.estado IN (:soporteVigente)
    )
    GROUP BY tr.id
  `, {
    replacements: {
      reintegroPendiente: ESTADOS_REINTEGRO.PENDIENTE,
      sinPago: [ESTADOS_GASTO.SOLICITADO, ESTADOS_GASTO.ANULADO],
      tipoReintegro: TIPOS_SOPORTE.REINTEGRO,
      soporteVigente: [ESTADOS_SOPORTE.PENDIENTE, ESTADOS_SOPORTE.APROBADO]
    },
    type: QueryTypes.SELECT
  })

// Resultado con la misma forma que las demás notificaciones programadas:
// encontradas = tramitadores con reintegros por enviar; sinTelefono = sin notificaciones activadas
export const recordarReintegrosPendientes = async () => {
  const filas = await consultarReintegrosPorEnviar()
  const cuenta = { encontradas: filas.length, enviadas: 0, sinTelefono: 0, errores: 0 }

  for (const fila of filas) {
    if (Number(fila.suscripciones) === 0) {
      cuenta.sinTelefono++
      continue
    }
    const cantidad = Number(fila.cantidad)
    const enviados = await enviarAvisoTramitador(Number(fila.tramitadorId), {
      titulo: cantidad === 1 ? 'Tiene un reintegro por enviar' : `Tiene ${cantidad} reintegros por enviar`,
      cuerpo: `Por reintegrar: ${formatoMoneda(Number(fila.valor))}. Suba el comprobante en Reintegros.`,
      url: '/gastos',
      // Cada día reemplaza el recordatorio anterior en lugar de acumularlos
      etiqueta: 'recordatorio-reintegros'
    })
    if (enviados > 0) cuenta.enviadas++
    else cuenta.errores++
  }

  return cuenta
}
