// middleware/auth.ts
import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import Usuarios from "../models/usuarios"
import Roles from "../models/gastos/roles"
import { ROLES, ROLES_CON_TORRE_CONTROL } from "../services/gastos/constantes"
import { ejecutarConContexto, origenDeRuta } from "../utils/contextoPeticion"

declare global {
  namespace Express {
    interface Request {
      // Códigos de rol del usuario (ej: ['TESORERIA']). Se cargan en `autenticacion`
      roles?: string[]
      // Los asignados tal cual (sin ADMIN ni Torre de control agregados): los devuelve /gastos/me
      rolesAsignados?: string[]
      // Ids de los usuarios de su misma área (se consultan una vez por petición)
      usuariosDeSuArea?: Promise<number[]>
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
      attributes: ["id", "nombreUsuario", "correoUsuario", "versionSesion", "areaId"],
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
    const asignados = (usuario.roles ?? []).map(rol => rol.codigo)
    // ADMIN de antes del 2026-10-23 (si aún estuviera activo) cuenta como administrador de las dos apps
    if (asignados.includes(ROLES.ADMIN)) asignados.push(ROLES.ADMIN_GASTOS, ROLES.ADMIN_TRAMITES)
    req.rolesAsignados = [...new Set(asignados.filter(rol => rol !== ROLES.ADMIN))]

    const roles = [...req.rolesAsignados]
    // Cada app tiene su administrador: ADMIN (acceso total) vale solo en las rutas de su app
    const rutaDeGastos = req.originalUrl.startsWith("/api/gastos")
    if (roles.includes(rutaDeGastos ? ROLES.ADMIN_GASTOS : ROLES.ADMIN_TRAMITES)) roles.push(ROLES.ADMIN)
    // Analista, Administrador de Torre de control y Administrador de Trámites trabajan con los
    // permisos de Torre de control
    if (roles.some(rol => ROLES_CON_TORRE_CONTROL.includes(rol)) && !roles.includes(ROLES.TORRE_CONTROL)) {
      roles.push(ROLES.TORRE_CONTROL)
    }
    req.roles = roles
    // El historial del trámite registra quién hizo cada cambio (ver utils/contextoPeticion)
    ejecutarConContexto(
      { usuarioId: usuario.id, tramitadorId: null, nombre: usuario.nombreUsuario, origen: origenDeRuta(req.originalUrl) },
      next
    )

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

// Ids de los usuarios de la misma área (incluido él). Sin área: solo él.
// Al buscar, cada usuario encuentra los trámites y gastos que crearon los de su área
export const usuariosDeMiArea = (req: Request): Promise<number[]> => {
  const areaId = req.usuario.areaId
  if (!areaId) return Promise.resolve([req.usuario.id])
  req.usuariosDeSuArea ??= Usuarios.findAll({ where: { areaId }, attributes: ["id"] }).then(usuarios => usuarios.map(u => u.id))
  return req.usuariosDeSuArea
}

// Gestión de activos sin Torre de control: quiénes crearon los trámites que puede abrir y trabajar
// (él y los de su área). null = sin límite
export const creadoresPermitidos = async (req: Request) => (soloTramitesPropios(req) ? usuariosDeMiArea(req) : null)

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
