import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { db } from '../../config/db'
import Usuarios from '../../models/usuarios'
import Roles from '../../models/gastos/roles'
import UsuarioRoles from '../../models/gastos/usuarioRoles'
import { correoIgual, hashcontrasena } from '../../utils/auth'
import { ErrorGastos } from '../../services/gastos/errores'
import { esAdmin, responderError } from './utilidades'
import { ROLES_TRAMITES } from '../../services/gastos/constantes'
import { desbloquearCuenta, minutosBloqueoCuenta } from '../../utils/intentosLogin'

// El Administrador de Torre de control (sin ADMIN) solo maneja perfiles de trámites:
// no asigna ni quita perfiles de Gastos o Administración, y no edita ni cambia la contraseña
// de usuarios que los tengan (así no puede entrar a Gastos con la cuenta de otro).
const soloTramites = (req: Request) => !esAdmin(req)
const fueraDeTramites = (codigos: string[]) => codigos.filter(c => !ROLES_TRAMITES.includes(c))

const codigosDelUsuario = async (usuarioId: number) => {
  const usuario = await Usuarios.findByPk(usuarioId, {
    attributes: ['id'],
    include: [{ model: Roles, attributes: ['codigo'], through: { attributes: [] } }]
  })
  return (usuario?.roles ?? []).map(r => r.codigo)
}

const verificarUsuarioDeTramites = async (req: Request, usuarioId: number) => {
  if (soloTramites(req) && fueraDeTramites(await codigosDelUsuario(usuarioId)).length) {
    throw new ErrorGastos('Este usuario tiene perfiles de Gastos o Administración: solo el administrador puede modificarlo', 403)
  }
}

export class RolesGastosController {

  // Usuario en sesión con sus roles: el frontend lo usa para armar el menú
  static me = async (req: Request, res: Response) => {
    res.json({
      id: req.usuario.id,
      nombreUsuario: req.usuario.nombreUsuario,
      correoUsuario: req.usuario.correoUsuario,
      roles: req.roles ?? []
    })
  }

  static getRoles = async (req: Request, res: Response) => {
    try {
      const roles = await Roles.findAll({
        where: { activo: true },
        attributes: ['id', 'codigo', 'nombre', 'descripcion'],
        order: [['nombre', 'ASC']]
      })

      res.json(roles)
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }

  static getUsuarios = async (req: Request, res: Response) => {
    try {
      const usuarios = await Usuarios.findAll({
        attributes: ['id', 'nombreUsuario', 'correoUsuario', 'area'],
        include: [{
          model: Roles,
          attributes: ['id', 'codigo', 'nombre'],
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

  // POST /admin/usuarios  { nombreUsuario, correoUsuario, area, contrasena, roles? }
  // La contraseña se guarda cifrada (bcrypt), igual que en el registro de cuenta
  static crearUsuario = async (req: Request, res: Response) => {
    try {
      const correo = String(req.body.correoUsuario).trim().toLowerCase()
      const codigos: string[] = req.body.roles ?? []

      if (soloTramites(req) && fueraDeTramites(codigos).length) {
        throw new ErrorGastos('Solo puede asignar perfiles de trámites', 403)
      }

      if (await Usuarios.findOne({ where: correoIgual(correo) })) {
        throw new ErrorGastos(`Ya existe un usuario con el correo ${correo}`, 409)
      }

      const roles = codigos.length
        ? await Roles.findAll({ where: { codigo: { [Op.in]: codigos }, activo: true } })
        : []
      if (roles.length !== new Set(codigos).size) throw new ErrorGastos('Uno o más roles no existen')

      const usuario = await db.transaction(async transaction => {
        const nuevo = await Usuarios.create({
          nombreUsuario: String(req.body.nombreUsuario).trim(),
          correoUsuario: correo,
          area: req.body.area?.trim() || null,
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

  // PUT /admin/usuarios/:usuarioId  { nombreUsuario, correoUsuario, area }
  static actualizarUsuario = async (req: Request, res: Response) => {
    try {
      const usuario = await Usuarios.findByPk(Number(req.params.usuarioId))
      if (!usuario) throw new ErrorGastos('Usuario no encontrado', 404)
      await verificarUsuarioDeTramites(req, usuario.id)

      const correo = String(req.body.correoUsuario).trim().toLowerCase()
      const repetido = await Usuarios.findOne({
        where: { [Op.and]: [correoIgual(correo), { id: { [Op.ne]: usuario.id } }] }
      })
      if (repetido) throw new ErrorGastos(`Ya existe otro usuario con el correo ${correo}`, 409)

      await usuario.update({
        nombreUsuario: String(req.body.nombreUsuario).trim(),
        correoUsuario: correo,
        area: req.body.area?.trim() || null
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
      await verificarUsuarioDeTramites(req, usuario.id)

      await usuario.update({ contrasena: await hashcontrasena(req.body.contrasena) })
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

  // Reemplaza los roles del usuario por los enviados: { roles: ['TESORERIA', 'CONTABILIDAD'] }
  // Un arreglo vacío le quita el acceso al módulo.
  static asignarRoles = async (req: Request, res: Response) => {
    const usuarioId = Number(req.params.usuarioId)
    const codigos: string[] = req.body.roles

    try {
      const usuario = await Usuarios.findByPk(usuarioId)

      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' })
      }

      const roles = await Roles.findAll({
        where: { codigo: { [Op.in]: codigos }, activo: true }
      })

      if (roles.length !== new Set(codigos).size) {
        return res.status(400).json({ error: 'Uno o más roles no existen' })
      }

      // Sin ADMIN, los perfiles de Gastos y Administración del usuario deben quedar como estaban
      if (soloTramites(req)) {
        const antes = fueraDeTramites(await codigosDelUsuario(usuarioId)).sort().join(',')
        const despues = fueraDeTramites([...new Set(codigos)]).sort().join(',')
        if (antes !== despues) {
          return res.status(403).json({ error: 'Solo puede asignar o quitar perfiles de trámites' })
        }
      }

      // Evita que un administrador se quite a sí mismo el rol ADMIN por error
      if (usuarioId === req.usuario.id && !codigos.includes('ADMIN') && req.roles?.includes('ADMIN')) {
        return res.status(400).json({ error: 'No puede quitarse su propio rol de administrador' })
      }

      await db.transaction(async transaction => {
        await UsuarioRoles.destroy({ where: { usuarioId }, transaction })

        await UsuarioRoles.bulkCreate(
          roles.map(rol => ({ usuarioId, rolId: rol.id })),
          { transaction }
        )
      })

      res.json('Roles actualizados correctamente')
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Hubo un error' })
    }
  }
}
