// middleware/auth.ts
import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import Usuarios from "../models/usuarios"
import Roles from "../models/gastos/roles"
import { ROLES, ROLES_CON_TORRE_CONTROL } from "../services/gastos/constantes"

declare global {
  namespace Express {
    interface Request {
      // Códigos de rol del usuario (ej: ['TESORERIA']). Se cargan en `autenticacion`
      roles?: string[]
    }
  }
}

export const autenticacion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  // 🔐 1. Intentar leer desde cookie (IMPORTANTE: nombre exacto)
  let token = req.cookies?.TOKEN || req.cookies?.token

  // 🔐 2. Si no existe en cookie, intentar header Authorization
  if (!token && req.headers.authorization) {
    const [, headerToken] = req.headers.authorization.split(" ")
    token = headerToken
  }

  if (!token) {
    return res.status(401).json({
      message: "Usuario no autorizado",
      totalProcesados: 0,
      creados: [],
      errores: []
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string)

    // Los tokens de la app de tramitadores no sirven para el sistema interno
    if (typeof decoded !== "object" || !decoded.id || decoded.tipo === "TRAMITADOR") {
      return res.status(401).json({
        message: "Token inválido",
        totalProcesados: 0,
        creados: [],
        errores: []
      })
    }

    const usuario = await Usuarios.findByPk(decoded.id, {
      attributes: ["id", "nombreUsuario", "correoUsuario", "versionSesion"],
      include: [{
        model: Roles,
        attributes: ["codigo"],
        where: { activo: true },
        required: false,
        through: { attributes: [] }
      }]
    })

    // Sesión cerrada o contraseña cambiada después de emitir el token. Los tokens sin versión
    // (anteriores a 2026-10-12, o de la versión 4.5 que comparte la clave) tampoco sirven.
    if (usuario && decoded.v !== usuario.versionSesion) {
      return res.status(401).json({
        message: "La sesión ya no es válida: inicie sesión de nuevo",
        totalProcesados: 0,
        creados: [],
        errores: []
      })
    }

    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no existe",
        totalProcesados: 0,
        creados: [],
        errores: []
      })
    }

    req.usuario = usuario
    const roles = (usuario.roles ?? []).map(rol => rol.codigo)
    // Analista y Administrador de Torre de control trabajan con los permisos de Torre de control
    if (roles.some(rol => ROLES_CON_TORRE_CONTROL.includes(rol)) && !roles.includes(ROLES.TORRE_CONTROL)) {
      roles.push(ROLES.TORRE_CONTROL)
    }
    req.roles = roles
    next()

  } catch (error) {
    return res.status(401).json({
      message: "Token no válido",
      totalProcesados: 0,
      creados: [],
      errores: []
    })
  }
}

// Gestión de activos sin Torre de control ni Admin: solo ve los trámites que creó
export const soloTramitesPropios = (req: Request) => {
  const roles = req.roles ?? []
  return roles.includes("GESTION_ACTIVOS") && !roles.includes("TORRE_CONTROL") && !roles.includes("ADMIN")
}

// Analista (sin ser administrador): en el inicio ve solo los trámites asignados a él
export const esAnalistaTramites = (req: Request) => {
  const roles = req.roles ?? []
  return roles.includes(ROLES.ANALISTA_TRAMITES) && !puedeAsignarAnalistas(req)
}

// Reasignar analistas: Administrador de Torre de control o Admin
export const puedeAsignarAnalistas = (req: Request) => {
  const roles = req.roles ?? []
  return roles.includes(ROLES.ADMIN_TORRE_CONTROL) || roles.includes(ROLES.ADMIN)
}

// Notificaciones automáticas de WhatsApp: Admin y Torre de control. El analista no, aunque
// trabaje con los permisos de Torre de control.
export const puedeConfigurarNotificaciones = (req: Request) => {
  const roles = req.roles ?? []
  return puedeAsignarAnalistas(req) || (roles.includes(ROLES.TORRE_CONTROL) && !roles.includes(ROLES.ANALISTA_TRAMITES))
}
