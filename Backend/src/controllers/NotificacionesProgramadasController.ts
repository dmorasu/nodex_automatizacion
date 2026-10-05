import type { Request, Response } from 'express'
import {
  ErrorNotificacionesProgramadas,
  actualizarNotificacionProgramada,
  enviarAhora,
  listarNotificacionesProgramadas
} from '../services/notificacionesProgramadas'

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorNotificacionesProgramadas) return res.status(error.status).json({ error: error.message })
  console.error('NOTIFICACIONES PROGRAMADAS:', error)
  return res.status(500).json({ error: 'No se pudo completar la operación' })
}

const nombreUsuario = (req: Request) => req.usuario?.nombreUsuario ?? `Usuario ${req.usuario?.id ?? ''}`.trim()

// Hora, días y activación de las notificaciones de diligencias (Admin y Torre de control)
export class NotificacionesProgramadasController {

  static listar = async (_req: Request, res: Response) => {
    try {
      res.json(await listarNotificacionesProgramadas())
    } catch (error) {
      responder(res, error)
    }
  }

  static actualizar = async (req: Request, res: Response) => {
    try {
      const { hora, dias, activa } = req.body ?? {}
      res.json(await actualizarNotificacionProgramada(req.params.clave, { hora, dias, activa }, nombreUsuario(req)))
    } catch (error) {
      responder(res, error)
    }
  }

  // Envía los WhatsApp en este momento; responde cuando todos quedan en la cola
  static enviarAhora = async (req: Request, res: Response) => {
    try {
      res.json(await enviarAhora(req.params.clave, nombreUsuario(req)))
    } catch (error) {
      responder(res, error)
    }
  }
}
