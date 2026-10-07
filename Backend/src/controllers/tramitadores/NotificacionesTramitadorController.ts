import type { Request, Response } from 'express'
import { clavePublicaPush, enviarAvisoTramitador, guardarSuscripcion, quitarSuscripcion } from '../../services/tramitadores/avisosPush'
import { responderError } from '../gastos/utilidades'

// ── App Nodex Tramitadores: notificaciones push del celular en sesión ──
export class NotificacionesTramitadorController {

  // GET /notificaciones/clave → clave pública para suscribir el celular (null = no disponibles)
  static clave = (_req: Request, res: Response) => {
    res.json({ clavePublica: clavePublicaPush() })
  }

  // POST /notificaciones/suscripcion  { endpoint, keys: { p256dh, auth }, navegador }
  // (el navegador lo manda la app: la petición llega desde su servidor, no del celular)
  static suscribir = async (req: Request, res: Response) => {
    try {
      const { endpoint, keys, navegador } = req.body
      await guardarSuscripcion(req.sesionTramitador!.tramitadorId, { endpoint, keys }, typeof navegador === 'string' ? navegador : null)
      res.status(201).json('Notificaciones activadas')
    } catch (error) {
      responderError(res, error)
    }
  }

  // DELETE /notificaciones/suscripcion  { endpoint }
  static desuscribir = async (req: Request, res: Response) => {
    try {
      await quitarSuscripcion(req.sesionTramitador!.tramitadorId, req.body.endpoint)
      res.json('Notificaciones desactivadas')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /notificaciones/prueba → para que el tramitador compruebe que le llegan
  static prueba = async (req: Request, res: Response) => {
    try {
      const enviados = await enviarAvisoTramitador(req.sesionTramitador!.tramitadorId, {
        titulo: 'Notificaciones activadas',
        cuerpo: 'Así le avisaremos de trámites nuevos y reintegros pendientes.',
        url: '/inicio',
        etiqueta: 'prueba'
      })
      if (enviados === 0) return res.status(409).json({ error: 'No se pudo enviar la prueba: active de nuevo las notificaciones' })
      res.json('Notificación de prueba enviada')
    } catch (error) {
      responderError(res, error)
    }
  }
}
