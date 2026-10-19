import { body, param } from 'express-validator'
import { contrasenaSegura } from '../../utils/politicaContrasena'
import { CATALOGOS } from '../../services/gastos/catalogosGastos'
import { PARAMETROS } from '../../services/gastos/constantes'

const NOMBRES_CATALOGOS = Object.keys(CATALOGOS)

export const validarCatalogo =
  param('catalogo')
    .isIn(NOMBRES_CATALOGOS)
    .withMessage(`Catálogo no válido. Opciones: ${NOMBRES_CATALOGOS.join(', ')}`)

export const validarCrearCatalogo = [
  validarCatalogo,

  body('nombre')
    .isString().withMessage('El nombre es obligatorio')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres')
]

export const validarActualizarCatalogo = [
  validarCatalogo,

  param('id')
    .isInt({ min: 1 }).withMessage('Id no válido'),

  body('nombre')
    .optional()
    .trim()
    .notEmpty().withMessage('El nombre no puede estar vacío')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres'),

  body('activo')
    .optional()
    .isBoolean().withMessage('Activo debe ser verdadero o falso')
    .toBoolean(),

  // Tipos de documento: para qué servicio se sube
  body(['paraPago', 'paraLegalizacion', 'paraReintegro'])
    .optional()
    .isBoolean().withMessage('El uso debe ser verdadero o falso')
    .toBoolean()
]

export const validarEliminarCatalogo = [
  validarCatalogo,
  param('id').isInt({ min: 1 }).withMessage('Id no válido')
]

export const validarActualizarParametro = [
  param('clave')
    .isIn(Object.values(PARAMETROS)).withMessage('Parámetro no válido'),

  body('valor')
    .isFloat({ min: 0, max: 1 }).withMessage('El valor debe ser un número entre 0 y 1 (ej: 0.11 = 11 %)')
]

const datosUsuario = [
  body('nombreUsuario')
    .isString().trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres'),
  body('correoUsuario')
    .isEmail().withMessage('Correo no válido')
    .isLength({ max: 100 }).withMessage('El correo no puede superar 100 caracteres'),
  body('areaId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Área no válida').toInt()
]

// Misma política del registro y del cambio de contraseña (utils/politicaContrasena.ts)
const contrasena = contrasenaSegura()

export const validarCrearUsuario = [
  ...datosUsuario,
  contrasena,
  body('roles').optional().isArray().withMessage('Roles no válidos'),
  body('roles.*').isString()
]

export const validarActualizarUsuario = [
  param('usuarioId').isInt({ min: 1 }).withMessage('Id de usuario no válido'),
  ...datosUsuario
]

export const validarRestablecerContrasena = [
  param('usuarioId').isInt({ min: 1 }).withMessage('Id de usuario no válido'),
  contrasena
]

export const validarAsignarRoles = [
  param('usuarioId')
    .isInt({ min: 1 }).withMessage('Id de usuario no válido'),

  body('roles')
    .isArray().withMessage('Debe enviar la lista de roles'),

  body('roles.*')
    .isString().withMessage('Cada rol debe ser un código de texto')
]
