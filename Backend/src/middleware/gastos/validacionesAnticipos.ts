import type { Request, Response, NextFunction } from 'express'
import { body, query } from 'express-validator'
import { CLASES_ANTICIPO, ESTADOS_ANTICIPO, TIPOS_ANTICIPO } from '../../services/gastos/constantes'

// Validan forma y tipos; las reglas de negocio están en services/gastos/anticipos.ts

// El formulario del anticipo llega en multipart (con el soporte de la consignación):
// los datos vienen en el campo "datos" como JSON y se pasan a req.body para validarlos
export const leerDatosJson = (req: Request, res: Response, next: NextFunction) => {
  if (typeof req.body?.datos !== 'string') return next()
  try {
    req.body = JSON.parse(req.body.datos)
    next()
  } catch {
    res.status(400).json({ error: 'Datos del anticipo no válidos' })
  }
}

const obligatorio = (campo: string, nombre: string, max: number) =>
  body(campo).isString().withMessage(`${nombre} es obligatorio`).trim()
    .notEmpty().withMessage(`${nombre} es obligatorio`)
    .isLength({ max }).withMessage(`${nombre} no puede superar ${max} caracteres`)

// Todos los campos son obligatorios (placa en vehículos; matrícula en inmuebles).
// El número de solicitud es el código que asigna el sistema (ANT-…)
export const validarAnticipo = [
  body('clase').optional({ values: 'falsy' }).isIn(Object.values(CLASES_ANTICIPO)).withMessage('Clase de anticipo no válida'),
  body('tipo').isIn(Object.values(TIPOS_ANTICIPO)).withMessage('Indique si el anticipo es de un vehículo o de un inmueble'),
  body('cliente.tipoIdentificacion').isIn(['CC', 'NIT']).withMessage('El tipo de identificación del cliente debe ser cédula o NIT'),
  obligatorio('cliente.identificacion', 'La identificación del cliente', 30),
  obligatorio('cliente.nombre', 'El nombre del cliente', 200),
  obligatorio('cliente.telefono', 'El teléfono del cliente', 30),
  obligatorio('cliente.direccion', 'La dirección del cliente', 200),
  // Obligatoria solo en las solicitudes de factura (lo revisa el servicio, que conoce la clase al editar)
  body('cliente.ciudad').optional({ values: 'null' }).isString().trim().isLength({ max: 150 }).withMessage('La ciudad del cliente no puede superar 150 caracteres'),
  // Obligatorio solo en las solicitudes de factura (lo revisa el servicio)
  body('cliente.correo').optional({ values: 'falsy' }).isString().trim().isEmail().withMessage('El correo del cliente no es válido')
    .isLength({ max: 100 }).withMessage('El correo del cliente no puede superar 100 caracteres'),
  body('clienteEmpresarialId').isInt({ min: 1 }).withMessage('Seleccione el cliente empresarial').toInt(),
  body('operacionId').isInt({ min: 1 }).withMessage('Seleccione la operación').toInt(),
  body('bolsaId').isInt({ min: 1 }).withMessage('Seleccione la bolsa').toInt(),
  obligatorio('concepto', 'El concepto', 200),
  body('placa').if(body('tipo').equals(TIPOS_ANTICIPO.VEHICULO)).isString().trim().notEmpty().withMessage('La placa es obligatoria').isLength({ max: 20 }),
  body('matriculaInmobiliaria').if(body('tipo').equals(TIPOS_ANTICIPO.INMUEBLE)).isString().trim().notEmpty().withMessage('La matrícula inmobiliaria es obligatoria').isLength({ max: 50 }),
  body('valorConsignado').isFloat({ gt: 0 }).withMessage('El valor consignado debe ser mayor a cero').toFloat(),
  body('fechaConsignacion').isISO8601({ strict: true }).withMessage('Indique la fecha de consignación'),
  // Obligatoria solo sin soporte de la consignación (lo revisa el servicio, que ve los archivos)
  body('referenciaPago').optional({ values: 'null' }).isString().trim().isLength({ max: 100 }).withMessage('La referencia del pago no puede superar 100 caracteres'),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 }),
  // Solicitudes de factura: retención en la fuente como fracción (0.11 = 11 %); vacía o 0 = no aplica
  body('retencionPorcentaje').optional({ values: 'null' }).isFloat({ min: 0, max: 0.5 }).withMessage('La retención en la fuente debe estar entre 0 % y 50 %').toFloat(),
  // Edición del administrador fuera de por confirmar / con novedad (el servicio exige el motivo)
  body('motivo').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }).withMessage('El motivo no puede superar 1000 caracteres'),
  body('valorRecibido').optional({ values: 'null' }).isFloat({ gt: 0 }).withMessage('El valor recibido debe ser mayor a cero').toFloat(),
  body('reciboCaja').optional({ values: 'null' }).isString().trim().isLength({ max: 50 }).withMessage('El recibo de caja no puede superar 50 caracteres'),
  body('numeroFactura').optional({ values: 'null' }).isString().trim().isLength({ max: 50 }).withMessage('El número de factura no puede superar 50 caracteres')
]

export const validarMotivo = body('motivo').isString().trim()
  .notEmpty().withMessage('Indique el motivo')
  .isLength({ max: 1000 }).withMessage('El motivo no puede superar 1000 caracteres')

// Contabilidad confirma uno o varios (recibo de caja masivo)
export const validarConfirmacionAnticipos = [
  body('anticipos').isArray({ min: 1, max: 200 }).withMessage('Seleccione entre 1 y 200 anticipos'),
  body('anticipos.*.id').isInt({ min: 1 }).withMessage('Anticipo no válido').toInt(),
  body('anticipos.*.valorRecibido').isFloat({ gt: 0 }).withMessage('El valor real ingresado debe ser mayor a cero').toFloat(),
  body('anticipos.*.reciboCaja').isString().trim()
    .notEmpty().withMessage('Indique el recibo de caja')
    .isLength({ max: 50 }).withMessage('El recibo de caja no puede superar 50 caracteres'),
  body('anticipos.*.observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

// Contabilidad confirma el pago y factura una o varias solicitudes de factura.
// Llega en multipart: datos = JSON con la lista; los archivos en pdf_<id> y xml_<id>
export const validarFacturacion = [
  body('solicitudes').isArray({ min: 1, max: 50 }).withMessage('Seleccione entre 1 y 50 solicitudes'),
  body('solicitudes.*.id').isInt({ min: 1 }).withMessage('Solicitud no válida').toInt(),
  body('solicitudes.*.valorRecibido').isFloat({ gt: 0 }).withMessage('El valor recibido debe ser mayor a cero').toFloat(),
  body('solicitudes.*.numeroFactura').isString().trim()
    .notEmpty().withMessage('Indique el número de factura')
    .isLength({ max: 50 }).withMessage('El número de factura no puede superar 50 caracteres'),
  body('solicitudes.*.observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

export const validarListadoAnticipos = [
  query('clase').optional().isIn(Object.values(CLASES_ANTICIPO)),
  query('estado').optional().custom(valor => String(valor).split(',').every(e => (Object.values(ESTADOS_ANTICIPO) as string[]).includes(e)))
    .withMessage('Estado no válido'),
  query('tipo').optional().isIn(Object.values(TIPOS_ANTICIPO)),
  query('bolsaId').optional().isInt({ min: 1 }),
  query('alcance').optional().isIn(['mios', 'todos']),
  query('busqueda').optional().isString().isLength({ max: 100 }),
  query('pagina').optional().isInt({ min: 1 }),
  query('tamano').optional().isInt({ min: 1, max: 200 })
]

// Reporte por centro de costos: rango de fechas de consignación (opcional)
export const validarReporteAnticipos = [
  query(['desde', 'hasta']).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida')
]
