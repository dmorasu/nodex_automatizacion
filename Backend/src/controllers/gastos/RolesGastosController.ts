import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { db } from '../../config/db'
import Usuarios from '../../models/usuarios'
import Roles from '../../models/gastos/roles'
import Areas from '../../models/areas'
import UsuarioRoles from '../../models/gastos/usuarioRoles'
import { correoIgual, hashcontrasena } from '../../utils/auth'
import { ErrorGastos } from '../../services/gastos/errores'
import { responderError } from './utilidades'
import { ROLES, ROLES_GASTOS_ASIGNABLES, ROLES_TRAMITES, rolesDelModulo, type ModuloRoles } from '../../services/gastos/constantes'
import { desbloquearCuenta, minutosBloqueoCuenta } from '../../utils/intentosLogin'

// Cada app maneja solo sus perfiles (decisión del usuario, 2026-10-23): Nodex Gastos los de
// Gastos (Administrador de Gastos) y Nodex Trámites los de Trámites (Administrador de Trámites o
// Administrador de Torre de control, que no toca al Administrador de Trámites). Los perfiles de
// la otra app no se envían ni se tocan, así un cambio en una no afecta la otra.
const asignadosDe = (req: Request) => req.rolesAsignados ?? []

const administra = (req: Request, modulo: ModuloRoles) => {
  const roles = asignadosDe(req)
  return modulo === 'GASTOS'
    ? roles.includes(ROLES.ADMIN_GASTOS)
    : roles.includes(ROLES.ADMIN_TRAMITES) || roles.includes(ROLES.ADMIN_TORRE_CONTROL)
}

// Perfiles que puede poner o quitar en esa app
const asignablesPor = (req: Request, modulo: ModuloRoles) =>
  administra(req, modulo)
    ? rolesDelModulo(modulo).filter(c => c !== ROLES.ADMIN_TRAMITES || asignadosDe(req).includes(ROLES.ADMIN_TRAMITES))
    : []

const moduloDe = (codigo: string): ModuloRoles | null =>
  ROLES_GASTOS_ASIGNABLES.includes(codigo) ? 'GASTOS' : ROLES_TRAMITES.includes(codigo) ? 'TRAMITES' : null

const codigosDelUsuario = async (usuarioId: number) => {
  const usuario = await Usuarios.findByPk(usuarioId, {
    attributes: ['id'],
    include: [{ model: Roles, attributes: ['codigo'], where: { activo: true }, required: false, through: { attributes: [] } }]
  })
  return (usuario?.roles ?? []).map(r => r.codigo)
}

// Área elegida del catálogo → { areaId, area }. `area` guarda el nombre en texto (lo lee la 4.5)
const areaDelUsuario = async (areaId: unknown) => {
  if (areaId === null || areaId === undefined || areaId === '') return { areaId: null, area: null }
  const area = await Areas.findByPk(Number(areaId))
  if (!area) throw new ErrorGastos('El área no existe')
  return { areaId: area.id, area: area.nombre }
}

// Datos y contraseña: los usuarios se crean y editan en Nodex Trámites, así que el Administrador de
// Trámites puede con todos. El Administrador de Torre de control no edita a quien tenga perfiles de
// Gastos o sea Administrador de Trámites (así no entra a otra app con la cuenta de otro), y el
// Administrador de Gastos no edita a quien tenga perfiles de Trámites.
const verificarPuedeEditar = async (req: Request, usuarioId: number) => {
  if (asignadosDe(req).includes(ROLES.ADMIN_TRAMITES)) return
  const codigos = await codigosDelUsuario(usuarioId)
  const ajeno = codigos.find(c => {
    const modulo = moduloDe(c)
    return modulo && !asignablesPor(req, modulo).includes(c)
  })
  if (ajeno) {
    throw new ErrorGastos(moduloDe(ajeno) === 'GASTOS'
      ? 'Este usuario tiene perfiles de Gastos: solo el Administrador de Trámites puede modificarlo'
      : 'Solo el Administrador de Trámites puede modificar a este usuario', 403)
  }
}

export class RolesGastosController {

  // Usuario en sesión con sus roles: el frontend lo usa para armar el menú. Van los asignados (sin
  // ADMIN): cada app trata como ADMIN a su propio administrador (ADMIN_GASTOS o ADMIN_TRAMITES)
  static me = async (req: Request, res: Response) => {
    res.json({
      id: req.usuario.id,
      nombreUsuario: req.usuario.nombreUsuario,
      correoUsuario: req.usuario.correoUsuario,
      roles: req.rolesAsignados ?? []
    })
  }

  static getRoles = async (req: Request, res: Response) => {
    try {
      const roles = await Roles.findAll({
        where: { activo: true },
        attributes: ['id', 'codigo', 'nombre', 'descripcion'],
        order: [['nombre', 'ASC']]
      })

      // Cada pantalla muestra solo los perfiles de su app
      res.json(roles.map(r => ({ ...r.toJSON(), modulo: moduloDe(r.codigo) })))
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  static getUsuarios = async (req: Request, res: Response) => {
    try {
      const usuarios = await Usuarios.findAll({
        attributes: ['id', 'nombreUsuario', 'correoUsuario', 'area', 'areaId'],
        include: [{
          model: Roles,
          attributes: ['id', 'codigo', 'nombre'],
          where: { activo: true },
          required: false,
          through: { attributes: [] }
        }],
        order: [['nombreUsuario', 'ASC']]
      })

      // Minutos de bloqueo por intentos fallidos en el login (0 = puede entrar)
      res.json(usuarios.map(u => ({ ...u.toJSON(), minutosBloqueo: minutosBloqueoCuenta(u.correoUsuario) })))
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  // POST /admin/usuarios  { nombreUsuario, correoUsuario, areaId, contrasena, roles? }
  // La contraseña se guarda cifrada (bcrypt), igual que en el registro de cuenta
  static crearUsuario = async (req: Request, res: Response) => {
    try {
      const correo = String(req.body.correoUsuario).trim().toLowerCase()
      const codigos: string[] = req.body.roles ?? []

      if (codigos.some(c => { const m = moduloDe(c); return !m || !asignablesPor(req, m).includes(c) })) {
        throw new ErrorGastos('Solo puede asignar los perfiles de su app', 403)
      }

      if (await Usuarios.findOne({ where: correoIgual(correo) })) {
        throw new ErrorGastos(`Ya existe un usuario con el correo ${correo}`, 409)
      }

      const roles = codigos.length
        ? await Roles.findAll({ where: { codigo: { [Op.in]: codigos }, activo: true } })
        : []
      if (roles.length !== new Set(codigos).size) throw new ErrorGastos('Uno o más roles no existen')
      const area = await areaDelUsuario(req.body.areaId)

      const usuario = await db.transaction(async transaction => {
        const nuevo = await Usuarios.create({
          nombreUsuario: String(req.body.nombreUsuario).trim(),
          correoUsuario: correo,
          ...area,
          contrasena: await hashcontrasena(req.body.contrasena)
        }, { transaction })

        if (roles.length) {
          await UsuarioRoles.bulkCreate(roles.map(rol => ({ usuarioId: nuevo.id, rolId: rol.id })), { transaction })
        }

        return nuevo
      })

      res.status(201).json({ id: usuario.id })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /admin/usuarios/:usuarioId  { nombreUsuario, correoUsuario, areaId }
  static actualizarUsuario = async (req: Request, res: Response) => {
    try {
      const usuario = await Usuarios.findByPk(Number(req.params.usuarioId))
      if (!usuario) throw new ErrorGastos('Usuario no encontrado', 404)
      await verificarPuedeEditar(req, usuario.id)

      const correo = String(req.body.correoUsuario).trim().toLowerCase()
      const repetido = await Usuarios.findOne({
        where: { [Op.and]: [correoIgual(correo), { id: { [Op.ne]: usuario.id } }] }
      })
      if (repetido) throw new ErrorGastos(`Ya existe otro usuario con el correo ${correo}`, 409)
      // Sin areaId en la petición, el área no cambia
      const area = 'areaId' in req.body ? await areaDelUsuario(req.body.areaId) : {}

      await usuario.update({
        nombreUsuario: String(req.body.nombreUsuario).trim(),
        correoUsuario: correo,
        ...area
      })

      res.json('Usuario actualizado')
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /admin/usuarios/:usuarioId/contrasena  { contrasena }
  static restablecerContrasena = async (req: Request, res: Response) => {
    try {
      const usuario = await Usuarios.findByPk(Number(req.params.usuarioId))
      if (!usuario) throw new ErrorGastos('Usuario no encontrado', 404)
      await verificarPuedeEditar(req, usuario.id)

      // Contraseña nueva y fuera de todas sus sesiones abiertas (por si alguien más la conocía)
      await usuario.update({ contrasena: await hashcontrasena(req.body.contrasena), versionSesion: usuario.versionSesion + 1 })
      // Con la contraseña nueva puede entrar de una vez, aunque estuviera bloqueado
      desbloquearCuenta(usuario.correoUsuario)

      res.json(`Contraseña de ${usuario.nombreUsuario} restablecida`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /admin/usuarios/:usuarioId/desbloquear → quita el bloqueo por intentos fallidos del login.
  // No cambia nada del usuario, por eso también lo puede hacer el Administrador de Torre de control
  // con cualquier usuario.
  static desbloquear = async (req: Request, res: Response) => {
    try {
      const usuario = await Usuarios.findByPk(Number(req.params.usuarioId), { attributes: ['id', 'nombreUsuario', 'correoUsuario'] })
      if (!usuario) throw new ErrorGastos('Usuario no encontrado', 404)
      desbloquearCuenta(usuario.correoUsuario)
      res.json(`${usuario.nombreUsuario} desbloqueado`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /admin/usuarios/:usuarioId/roles  { modulo: 'GASTOS' | 'TRAMITES', roles: [...] }
  // Reemplaza solo los perfiles de esa app; los de la otra quedan como están en la base
  // (aunque la pantalla tenga datos viejos). Un arreglo vacío le quita el acceso a esa app.
  static asignarRoles = async (req: Request, res: Response) => {
    try {
      const usuarioId = Number(req.params.usuarioId)
      const modulo = req.body.modulo as ModuloRoles
      const codigos = [...new Set(req.body.roles as string[])]

      const usuario = await Usuarios.findByPk(usuarioId, { attributes: ['id'] })
      if (!usuario) throw new ErrorGastos('Usuario no encontrado', 404)
      if (!administra(req, modulo)) throw new ErrorGastos('No administra los perfiles de esta app', 403)

      const delModulo = rolesDelModulo(modulo)
      if (codigos.some(c => !delModulo.includes(c))) {
        throw new ErrorGastos(modulo === 'GASTOS' ? 'Solo puede enviar perfiles de Gastos' : 'Solo puede enviar perfiles de Trámites')
      }

      const antes = (await codigosDelUsuario(usuarioId)).filter(c => delModulo.includes(c))
      const cambiados = [...antes.filter(c => !codigos.includes(c)), ...codigos.filter(c => !antes.includes(c))]
      const permitidos = asignablesPor(req, modulo)
      if (cambiados.some(c => !permitidos.includes(c))) {
        throw new ErrorGastos('Solo el Administrador de Trámites puede asignar o quitar ese perfil', 403)
      }

      // Evita que un administrador se quite a sí mismo la administración de esa app por error
      const suAdmin = modulo === 'GASTOS' ? ROLES.ADMIN_GASTOS : ROLES.ADMIN_TRAMITES
      if (usuarioId === req.usuario.id && antes.includes(suAdmin) && !codigos.includes(suAdmin)) {
        throw new ErrorGastos('No puede quitarse su propio perfil de administrador')
      }

      const roles = await Roles.findAll({ where: { codigo: { [Op.in]: delModulo } }, attributes: ['id', 'codigo', 'activo'] })
      const nuevos = roles.filter(r => r.activo && codigos.includes(r.codigo))
      if (nuevos.length !== codigos.length) throw new ErrorGastos('Uno o más perfiles no existen')

      await db.transaction(async transaction => {
        await UsuarioRoles.destroy({ where: { usuarioId, rolId: { [Op.in]: roles.map(r => r.id) } }, transaction })
        await UsuarioRoles.bulkCreate(nuevos.map(rol => ({ usuarioId, rolId: rol.id })), { transaction })
      })

      res.json('Perfiles actualizados correctamente')
    } catch (error) {
      responderError(res, error)
    }
  }
}
