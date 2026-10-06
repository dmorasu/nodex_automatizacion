import { body, param, query } from 'express-validator'
import { ESTADOS_GASTO } from '../../services/gastos/constantes'

// Validan forma y tipos. Las reglas de negocio (tipo de gasto, beneficiario,
// relaciones) se validan en services/gastos/solicitudesGasto.ts
const idOpcional = (campo: string) =>
  body(campo)
    .optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage(`${campo} no válido`)
    .toInt()

const textoOpcional = (campo: string, max: number) =>
  body(campo)
    .optional({ values: 'null' })
    .isString().withMessage(`${campo} debe ser texto`)
    .trim()
    .isLength({ max }).withMessage(`${campo} no puede superar ${max} caracteres`)

export const validarId = param('id').isInt({ min: 1 }).withMessage('Id no válido').toInt()

export const validarGasto = [
  body('operacionId').isInt({ min: 1 }).withMessage('Debe seleccionar la operación').toInt(),
  body('bolsaId').isInt({ min: 1 }).withMessage('Debe seleccionar la bolsa').toInt(),
  body('tipoGastoId').isInt({ min: 1 }).withMessage('Debe seleccionar el tipo de gasto').toInt(),
  body('formaPagoId').isInt({ min: 1 }).withMessage('Debe seleccionar la forma de pago').toInt(),
  idOpcional('solicitudTramiteId'),
  idOpcional('tramitadorId'),
  idOpcional('beneficiarioId'),

  body('conceptoPago')
    .isString().trim()
    .notEmpty().withMessage('El concepto de pago es obligatorio')
    .isLength({ max: 200 }).withMessage('El concepto de pago no puede superar 200 caracteres'),

  body('valorSolicitado')
    .isFloat({ gt: 0 }).withMessage('El valor solicitado debe ser un número mayor a cero')
    .toFloat(),

  // Retención (solo inmuebles; vacía = valores por defecto)
  body('baseRetencion')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 }).withMessage('La base de retención debe ser un número mayor o igual a cero')
    .toFloat(),
  body('porcentajeRetencion')
    .optional({ values: 'null' })
    .isFloat({ min: 0, max: 100 }).withMessage('El porcentaje de retención debe estar entre 0 y 100')
    .toFloat(),

  body('reembolsable').optional().isBoolean().withMessage('Reembolsable debe ser verdadero o falso').toBoolean(),

  textoOpcional('numeroFactura', 50),
  textoOpcional('matriculaInmobiliaria', 50),
  textoOpcional('placa', 20),
  textoOpcional('transito', 100),
  textoOpcional('contrato', 50),
  textoOpcional('nombreClienteBanco', 200),
  textoOpcional('identificacionClienteBanco', 30),
  textoOpcional('codigoBpr', 50),
  textoOpcional('observacion', 2000),

  body('beneficiario').optional({ values: 'null' }).isObject().withMessage('Beneficiario no válido'),
  body('beneficiario.identificacion').optional().isString().trim().isLength({ max: 30 }),
  body('beneficiario.nombre').optional().isString().trim().isLength({ max: 200 }),
  body('beneficiario.tipoIdentificacion').optional({ values: 'null' }).isString().trim().isLength({ max: 10 }),
  body('beneficiario.banco').optional({ values: 'null' }).isString().trim().isLength({ max: 100 }),
  body('beneficiario.tipoCuenta').optional({ values: 'falsy' }).isIn(['AHORROS', 'CORRIENTE']).withMessage('Tipo de cuenta no válido'),
  body('beneficiario.numeroCuenta').optional({ values: 'null' }).isString().trim().isLength({ max: 30 }),
  body('beneficiario.correo').optional({ values: 'falsy' }).isEmail().withMessage('Correo del beneficiario no válido')
]

export const validarAnulacion = [
  validarId,
  body('motivo')
    .isString().trim()
    .notEmpty().withMessage('Debe indicar el motivo de la anulación')
    .isLength({ max: 1000 }).withMessage('El motivo no puede superar 1000 caracteres')
]

export const validarBolsa = [
  body('nombre')
    .optional()
    .isString().trim()
    .notEmpty().withMessage('El nombre de la bolsa es obligatorio')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres'),
  body('lineaNegocio').optional({ values: 'null' }).isString().trim().isLength({ max: 100 }),
  body('activo').optional().isBoolean().withMessage('Activo debe ser verdadero o falso')
]

export const validarCrearBolsa = [
  body('nombre').exists().withMessage('El nombre de la bolsa es obligatorio'),
  ...validarBolsa
]

export const validarRecarga = [
  validarId,
  body('valor').isFloat({ gt: 0 }).withMessage('El valor de la recarga debe ser mayor a cero').toFloat(),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

export const validarAjuste = [
  validarId,
  body('valor')
    .isFloat().withMessage('El valor del ajuste debe ser un número (negativo para restar)')
    .custom(valor => Number(valor) !== 0).withMessage('El valor del ajuste no puede ser cero')
    .toFloat(),
  body('observacion')
    .isString().trim()
    .notEmpty().withMessage('Debe explicar el motivo del ajuste')
    .isLength({ max: 1000 })
]

// Tesorería programa el pago (aún no descuenta la bolsa)
export const validarProgramacion = [
  body('bolsaId').isInt({ min: 1 }).withMessage('Debe seleccionar la bolsa').toInt(),
  body('fechaPago').isISO8601({ strict: true }).withMessage('Fecha programada no válida'),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }),
  body('gastos')
    .isArray({ min: 1, max: 200 }).withMessage('Debe seleccionar entre 1 y 200 gastos'),
  body('gastos.*.id').isInt({ min: 1 }).withMessage('Gasto no válido').toInt(),
  body('gastos.*.valorProgramado')
    .isFloat({ gt: 0 }).withMessage('El valor a pagar de cada gasto debe ser mayor a cero')
    .toFloat(),
]

// Pago directo de compras de certificados
export const validarPagoDirecto = [
  body('bolsaId').isInt({ min: 1 }).withMessage('Debe seleccionar la bolsa').toInt(),
  body('fechaPago').isISO8601({ strict: true }).withMessage('Fecha de pago no válida'),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }),
  body('gastos').isArray({ min: 1, max: 200 }).withMessage('Debe seleccionar entre 1 y 200 gastos'),
  body('gastos.*.id').isInt({ min: 1 }).withMessage('Gasto no válido').toInt(),
  body('gastos.*.valorRealmentePagado').isFloat({ gt: 0 }).withMessage('El valor pagado de cada gasto debe ser mayor a cero').toFloat()
]

// Gastos del lote a aprobar (opcional: sin lista se aprueban todos los pendientes)
export const validarAprobacionLote = [
  validarId,
  body('gastoIds').optional({ values: 'null' }).isArray({ min: 1, max: 200 }).withMessage('Seleccione los gastos'),
  body('gastoIds.*').isInt({ min: 1 }).withMessage('Gasto no válido').toInt()
]

// Rechazar (Dirección) o quitar (Tesorería) gastos del lote: siempre con motivo
export const validarSalidaLote = [
  validarId,
  body('gastoIds').isArray({ min: 1, max: 200 }).withMessage('Seleccione los gastos'),
  body('gastoIds.*').isInt({ min: 1 }).withMessage('Gasto no válido').toInt(),
  body('motivo').isString().trim().isLength({ min: 3, max: 500 }).withMessage('Indique el motivo (mínimo 3 caracteres)')
]

export const validarConfirmacionPago = [
  validarId,
  body('fechaPago').isISO8601({ strict: true }).withMessage('Fecha de pago no válida'),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 })
]

// ── Legalización ──────────────────────────

const fechaOpcional = (campo: string) =>
  body(campo).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida')

export const validarCuentaCobro = [
  body('numeroCuentaCobro')
    .isString().trim()
    .notEmpty().withMessage('El número de la cuenta de cobro es obligatorio')
    .isLength({ max: 50 }).withMessage('El número no puede superar 50 caracteres'),
  fechaOpcional('fechaRadicacion'),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 })
]

export const validarAgregarGastos = [
  validarId,
  body('gastoIds').isArray({ min: 1, max: 200 }).withMessage('Debe seleccionar entre 1 y 200 gastos'),
  body('gastoIds.*').isInt({ min: 1 }).withMessage('Gasto no válido').toInt()
]

export const validarFactura = [
  validarId,
  body('numeroFactura').optional({ values: 'null' }).isString().trim().isLength({ max: 50 }),
  body('tieneFacturaReal').isBoolean().withMessage('Indique si tiene factura real').toBoolean(),
  body('valorFactura').isFloat({ gt: 0 }).withMessage('El valor de la factura debe ser mayor a cero').toFloat(),
  body('identificacionTerceroReal').optional({ values: 'null' }).isString().trim().isLength({ max: 30 }),
  body('nombreTerceroReal').optional({ values: 'null' }).isString().trim().isLength({ max: 200 }),
  body('observacion').optional({ values: 'null' }).isString().trim().isLength({ max: 2000 })
]

export const validarLegalizar = [validarId, fechaOpcional('fechaRadicacion')]

export const validarReintegrar = [
  validarId,
  body('fechaReintegro').isISO8601({ strict: true }).withMessage('Indique la fecha en que se recibió el reintegro')
]

// ── Contabilidad ──────────────────────────

export const validarEgreso = [
  validarId,
  body('numeroEgreso')
    .isString().trim()
    .notEmpty().withMessage('Indique el número de egreso')
    .isLength({ max: 50 }).withMessage('El número de egreso no puede superar 50 caracteres')
]

export const validarContabilizacion = [
  body('cuentas').isArray({ min: 1, max: 200 }).withMessage('Seleccione entre 1 y 200 cuentas de cobro'),
  body('cuentas.*.id').isInt({ min: 1 }).withMessage('Cuenta de cobro no válida').toInt(),
  body('cuentas.*.documentoContable')
    .isString().trim()
    .notEmpty().withMessage('El documento contable es obligatorio en cada cuenta')
    .isLength({ max: 50 }).withMessage('El documento contable no puede superar 50 caracteres'),
  fechaOpcional('fechaContabilizacion')
]

// ── Tablero y reportes ────────────────────

const fechaQuery = (campo: string) =>
  query(campo).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida')

export const validarFiltrosTablero = [
  query('bolsaId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Bolsa no válida'),
  fechaQuery('desde'),
  fechaQuery('hasta')
]

export const validarFiltrosReintegrosTramitador = [
  ...validarFiltrosTablero,
  query('busqueda').optional().isString().isLength({ max: 100 }).withMessage('Búsqueda no válida'),
  query('estado').optional({ values: 'falsy' }).isIn(['pendientes', 'todos']).withMessage('Estado no válido'),
  query('diasMinimos').optional({ values: 'falsy' }).isInt({ min: 1, max: 3650 }).withMessage('Antigüedad no válida')
]

export const validarFiltrosReporte = [
  ...validarFiltrosTablero,
  query('estado').optional({ values: 'falsy' }).isIn(Object.values(ESTADOS_GASTO)).withMessage('Estado no válido')
]

export const validarListadoLotes = [
  query('busqueda').optional().isString().trim().isLength({ max: 100 }),
  query('bolsaId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Bolsa no válida'),
  query('desde').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida'),
  query('hasta').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida'),
  query('egreso').optional({ values: 'falsy' }).isIn(['pendiente', 'registrado']),
  // Uno o varios estados del lote separados por coma (PROGRAMADO,APROBADO)
  query('estado').optional({ values: 'falsy' }).matches(/^(PROGRAMADO|APROBADO|PAGADO|RECHAZADO)(,(PROGRAMADO|APROBADO|PAGADO|RECHAZADO))*$/).withMessage('Estado no válido'),
  query('pagina').optional().isInt({ min: 1 }).toInt()
]

export const validarContabilizacionGastos = [
  body('gastos').isArray({ min: 1, max: 200 }).withMessage('Seleccione entre 1 y 200 gastos'),
  body('gastos.*.id').isInt({ min: 1 }).withMessage('Gasto no válido').toInt(),
  body('gastos.*.documentoContable')
    .isString().trim()
    .notEmpty().withMessage('El documento contable es obligatorio en cada gasto')
    .isLength({ max: 50 }).withMessage('El documento contable no puede superar 50 caracteres'),
  fechaOpcional('fechaContabilizacion')
]

export const validarListado = [
  // Los filtros vacíos (formularios GET) se ignoran
  query('alcance').optional({ values: 'falsy' }).isIn(['mios', 'todos']).withMessage('Alcance no válido'),
  query('estado').optional({ values: 'falsy' }).isIn(Object.values(ESTADOS_GASTO)).withMessage('Estado no válido'),
  query('tipoGastoId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  query('bolsaId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  query('reembolsable').optional({ values: 'falsy' }).isIn(['si', 'no']).withMessage('reembolsable debe ser si o no'),
  query('sinCuentaCobro').optional().isIn(['si']),
  query('soporteTramitador').optional({ values: 'falsy' }).isIn(['si', 'no']),
  query('pagados').optional({ values: 'falsy' }).isIn(['si']),
  query('certificados').optional({ values: 'falsy' }).isIn(['si', 'no']),
  query('conTramite').optional({ values: 'falsy' }).isIn(['si', 'no']),
  query('reintegroPendiente').optional({ values: 'falsy' }).isIn(['si']),
  query(['operacionId', 'tramitadorId', 'creadoPor']).optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Filtro no válido'),
  query(['desde', 'hasta', 'pagoDesde', 'pagoHasta']).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida'),
  query('orden').optional({ values: 'falsy' }).isIn(['recientes', 'antiguos', 'pagoReciente', 'valorMayor', 'valorMenor']),
  query('totales').optional({ values: 'falsy' }).isIn(['si']),
  query('busqueda').optional().isString().trim().isLength({ max: 100 }),
  query('pagina').optional().isInt({ min: 1 }).toInt(),
  query('tamano').optional().isInt({ min: 1, max: 100 }).toInt()
]
