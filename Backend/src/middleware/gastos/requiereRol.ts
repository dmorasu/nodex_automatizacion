import type { Request, Response, NextFunction } from 'express'
import { CodigoRol, ROLES } from '../../services/gastos/constantes'

// Permite el paso si el usuario tiene alguno de los roles indicados.
// ADMIN siempre tiene acceso. Debe usarse después de `autenticacion`.
export const requiereRol = (...rolesPermitidos: CodigoRol[]) =>
  (req: Request, res: Response, next: NextFunction) => {

    const rolesUsuario = req.roles ?? []

    const autorizado =
      rolesUsuario.includes(ROLES.ADMIN) ||
      rolesPermitidos.some(rol => rolesUsuario.includes(rol))

    if (!autorizado) {
      return res.status(403).json({
        error: 'No tiene permisos para realizar esta acción'
      })
    }

    next()
  }
