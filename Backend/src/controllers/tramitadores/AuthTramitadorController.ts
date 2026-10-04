import type { Request, Response } from 'express'
import { cambiarContrasena, iniciarSesion } from '../../services/tramitadores/accesoTramitadores'
import { responderError } from '../gastos/utilidades'

// Inicio de sesión y cuenta del tramitador en la app Nodex Tramitadores
export class AuthTramitadorController {

  // POST /auth/login  { identificacion, contrasena }
  static login = async (req: Request, res: Response) => {
    try {
      res.json(await iniciarSesion(String(req.body.identificacion), String(req.body.contrasena)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /auth/me
  static me = (req: Request, res: Response) => {
    const sesion = req.sesionTramitador!
    res.json({
      id: sesion.tramitadorId,
      nombre: sesion.nombre,
      identificacion: sesion.identificacion,
      esMensajero: sesion.esMensajero,
      debeCambiarContrasena: sesion.acceso.debeCambiarContrasena
    })
  }

  // POST /auth/cambiar-contrasena  { contrasenaActual, contrasena }
  static cambiarContrasena = async (req: Request, res: Response) => {
    try {
      const sesion = req.sesionTramitador!
      res.json(await cambiarContrasena(sesion.acceso, sesion.identificacion, req.body.contrasenaActual, req.body.contrasena))
    } catch (error) {
      responderError(res, error)
    }
  }
}
