import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import Tramitador from '../../models/tramitador'
import AccesoTramitador from '../../models/tramitadores/accesoTramitador'
import { TIPO_TOKEN_TRAMITADOR } from '../../services/tramitadores/accesoTramitadores'
import { ejecutarConContexto } from '../../utils/contextoPeticion'

export type SesionTramitador = {
  tramitadorId: number
  nombre: string
  identificacion: string
  // Tiene ruta diaria ("Mi ruta" en la app)
  esMensajero: boolean
  acceso: AccesoTramitador
}

declare global {
  namespace Express {
    interface Request {
      // Tramitador en sesión en la app Nodex Tramitadores (se carga en `autenticacionTramitador`)
      sesionTramitador?: SesionTramitador
    }
  }
}

const noAutorizado = (res: Response, error = 'Sesión no válida. Inicie sesión de nuevo') =>
  res.status(401).json({ error })

// Sesión de tramitador. En cada petición se revisa que el acceso exista, que la
// contraseña no se haya restablecido después del ingreso y que el tramitador siga activo:
// si lo desactivan, sale de inmediato.
export const autenticacionTramitador = async (req: Request, res: Response, next: NextFunction) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ')
  if (esquema !== 'Bearer' || !token) return noAutorizado(res)

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET as string)
    if (typeof datos !== 'object' || datos.tipo !== TIPO_TOKEN_TRAMITADOR || !datos.tramitadorId) {
      return noAutorizado(res)
    }

    const acceso = await AccesoTramitador.findOne({
      where: { tramitadorId: Number(datos.tramitadorId) },
      include: [{ model: Tramitador, attributes: ['id', 'nombreTramitador', 'identificacion', 'activo', 'esMensajero'] }]
    })

    if (!acceso || acceso.versionSesion !== datos.v) return noAutorizado(res)
    if (!acceso.tramitador?.activo) {
      return noAutorizado(res, 'Su usuario está inactivo. Comuníquese con Torre de control')
    }

    req.sesionTramitador = {
      tramitadorId: acceso.tramitadorId,
      nombre: acceso.tramitador.nombreTramitador,
      identificacion: acceso.tramitador.identificacion,
      esMensajero: acceso.tramitador.esMensajero,
      acceso
    }
    ejecutarConContexto(
      { usuarioId: null, tramitadorId: acceso.tramitadorId, nombre: acceso.tramitador.nombreTramitador?.trim(), origen: 'APP_TRAMITADOR' },
      next
    )
  } catch {
    return noAutorizado(res)
  }
}

// Con contraseña temporal solo puede cambiarla: el resto de la app queda cerrado
export const exigirContrasenaDefinitiva = (req: Request, res: Response, next: NextFunction) => {
  if (req.sesionTramitador?.acceso.debeCambiarContrasena) {
    return res.status(403).json({ error: 'Debe cambiar su contraseña temporal', codigo: 'DEBE_CAMBIAR_CONTRASENA' })
  }
  next()
}
