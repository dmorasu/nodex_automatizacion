import { body, param, query } from 'express-validator'
import { ESTADOS_REEMBOLSO_CAJA } from '../../services/gastos/constantes'

// Validan forma y tipos; las reglas de negocio están en services/gastos/cajaMenor.ts

const obligatorio = (campo: string, nombre: string, max: number) =>
  body(campo).isString().withMessage(`${nombre} es obligatorio`).trim()
    .notEmpty().withMessage(`${nombre} es obligatorio`)
    .isLength({ max }).withMessage(`${nombre} no puede superar ${max} caracteres`)

const fecha = (campo: string, nombre: string) => body(campo).isISO8601({ strict: true }).withMessage(`Indique ${nombre}`)

export const validarCaja = [
  obligatorio('nombre', 'El nombre de la caja', 100),
  body('fondo').isFloat({ gt: 0 }).withMessage('El fondo debe ser mayor a cero').toFloat(),
  body('topeAlerta').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('El tope de alerta no es válido').toFloat()
]

export const validarActualizarCaja = [
  param('id').isInt({ min: 1 }).toInt(),
  body('nombre').optional().isString().trim().notEmpty().withMessage('Escriba el nombre').isLength({ max: 100 }),
  body('fondo').optional().isFloat({ gt: 0 }).withMessage('El fondo debe ser mayor a cero').toFloat(),
  body('topeAlerta').optional().isFloat({ min: 0 }).withMessage('El tope de alerta no es válido').toFloat(),
  body('activo').optional().isBoolean().toBoolean()
]

export const validarAsignacion = [
  param('usuarioId').isInt({ min: 1 }).toInt(),
  body('bolsaId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Caja no válida').toInt()
]

export const validarPagoCaja = [
  body('bolsaId').isInt({ min: 1 }).withMessage('Seleccione la caja').toInt(),
  fecha('fechaPago', 'la fecha de entrega del efectivo'),
  body('gastos').isArray({ min: 1, max: 100 }).withMessage('Seleccione entre 1 y 100 gastos'),
  body('gastos.*.id').isInt({ min: 1 }).toInt(),
  body('gastos.*.valorEntregado').isFloat({ gt: 0 }).withMessage('El valor entregado debe ser mayor a cero').toFloat(),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

// Todo obligatorio salvo placa / matrícula (según el gasto) y observación
export const validarLegalizacionCaja = [
  param('id').isInt({ min: 1 }).toInt(),
  obligatorio('numeroFactura', 'El número de factura', 50),
  fecha('fechaFactura', 'la fecha de la factura'),
  obligatorio('beneficiario', 'El beneficiario', 200),
  body('tipoIdentificacion').isIn(['CC', 'NIT']).withMessage('El tipo de documento debe ser CC o NIT'),
  obligatorio('identificacion', 'La identificación', 30),
  body('placa').optional({ values: 'null' }).isString().trim().isLength({ max: 20 }),
  body('matriculaInmobiliaria').optional({ values: 'null' }).isString().trim().isLength({ max: 50 }),
  obligatorio('quienLegaliza', 'Quién legaliza', 150),
  body('valorSoporte').isFloat({ gt: 0 }).withMessage('El valor del soporte debe ser mayor a cero').toFloat(),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

export const validarNuevoReembolso = [
  body('bolsaId').isInt({ min: 1 }).withMessage('Seleccione la caja').toInt(),
  body('gastoIds').isArray({ min: 1, max: 300 }).withMessage('Seleccione los gastos del reembolso'),
  body('gastoIds.*').isInt({ min: 1 }).toInt(),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

export const validarGastosReembolso = [
  param('id').isInt({ min: 1 }).toInt(),
  body('gastoIds').isArray({ min: 1, max: 300 }).withMessage('Seleccione los gastos'),
  body('gastoIds.*').isInt({ min: 1 }).toInt()
]

export const validarLegalizacionReembolso = [
  param('id').isInt({ min: 1 }).toInt(),
  fecha('fechaLegalizacion', 'la fecha en que se recibió el reembolso'),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

export const validarListadoReembolsos = [
  query('bolsaId').optional().isInt({ min: 1 }),
  query('estado').optional().custom(valor => String(valor).split(',').every(e => (Object.values(ESTADOS_REEMBOLSO_CAJA) as string[]).includes(e)))
    .withMessage('Estado no válido'),
  query('pagina').optional().isInt({ min: 1 }),
  query('tamano').optional().isInt({ min: 1, max: 100 })
]

export const validarHistorialCaja = [
  param('id').isInt({ min: 1 }).toInt(),
  query('estado').optional({ values: 'falsy' }).isIn(['PAGADO_CAJA', 'PENDIENTE_REEMBOLSO', 'EN_REEMBOLSO', 'LEGALIZADO_CAJA']).withMessage('Estado no válido'),
  query('desde').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha desde no válida'),
  query('hasta').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha hasta no válida'),
  query('quienLegaliza').optional().isString().isLength({ max: 150 }),
  query('busqueda').optional().isString().isLength({ max: 100 }),
  query('pagina').optional().isInt({ min: 1 }),
  query('tamano').optional().isInt({ min: 1, max: 100 })
]
