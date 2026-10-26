import { Router } from 'express'
import { body, param } from 'express-validator'
import { handleInputErrors } from '../middleware/validation'
import { CuentasCobroTorreController } from '../controllers/CuentasCobroTramitadoresController'

// Cuentas de cobro de los tramitadores en Torre de control (/api/cuentas-cobro-tramitadores).
// La sesión y el perfil Torre de control se exigen en server.ts
const router = Router()

const idCuenta = param('id').isInt({ min: 1 }).withMessage('Cuenta no válida')
const idLinea = param('lineaId').isInt({ min: 1 }).withMessage('Línea no válida')
const listaIds = (campo: string) => body(campo).isArray({ min: 1, max: 200 }).withMessage('Elija al menos uno').bail()
  .custom((ids: unknown[]) => ids.every(x => Number.isInteger(Number(x)) && Number(x) > 0)).withMessage('Datos no válidos')
const valor = body('valor').isFloat({ min: 0, max: 100_000_000 }).withMessage('El valor no es válido')
const motivo = body('motivo').optional({ values: 'null' }).isString().isLength({ max: 1000 }).withMessage('El motivo puede tener máximo 1000 caracteres')

router.get('/por-generar', CuentasCobroTorreController.porGenerar)
router.post('/generar',
  body('precuentas').isArray({ min: 1, max: 200 }).withMessage('Elija al menos uno'),
  body('precuentas.*.tramitadorId').isInt({ min: 1 }).withMessage('Tramitador no válido'),
  body('precuentas.*.semana').isISO8601({ strict: true }).withMessage('Semana no válida'),
  handleInputErrors,
  CuentasCobroTorreController.generar
)
router.post('/visto-bueno', listaIds('cuentaIds'), handleInputErrors, CuentasCobroTorreController.vistoBueno)

router.get('/', CuentasCobroTorreController.listar)
router.get('/exportar', CuentasCobroTorreController.exportar)
router.get('/:id', idCuenta, handleInputErrors, CuentasCobroTorreController.detalle)
router.get('/:id/pdf', idCuenta, handleInputErrors, CuentasCobroTorreController.pdf)
router.get('/:id/soporte-pago', idCuenta, handleInputErrors, CuentasCobroTorreController.soportePago)

router.post('/:id/lineas',
  idCuenta,
  body('solicitudTramiteId').isInt({ min: 1 }).withMessage('Trámite no válido'),
  body('tipo').isIn(['VISITA_FALLIDA', 'ADICIONAL']).withMessage('Tipo de línea no válido'),
  body('concepto').isString().trim().notEmpty().withMessage('Indique el concepto').isLength({ max: 200 }),
  body('fecha').isISO8601({ strict: true }).withMessage('La fecha no es válida'),
  valor,
  handleInputErrors,
  CuentasCobroTorreController.agregarLinea
)
router.put('/:id/lineas/:lineaId',
  idCuenta,
  idLinea,
  valor.optional(),
  body('concepto').optional().isString().isLength({ max: 200 }),
  body('fecha').optional().isISO8601({ strict: true }).withMessage('La fecha no es válida'),
  handleInputErrors,
  CuentasCobroTorreController.editarLinea
)
router.delete('/:id/lineas/:lineaId', idCuenta, idLinea, handleInputErrors, CuentasCobroTorreController.quitarLinea)
router.get('/:id/lineas/:lineaId/soporte', idCuenta, idLinea, handleInputErrors, CuentasCobroTorreController.soporteLinea)

router.post('/:id/enviar', idCuenta, handleInputErrors, CuentasCobroTorreController.enviar)
router.post('/:id/retirar', idCuenta, motivo, handleInputErrors, CuentasCobroTorreController.retirar)
router.post('/:id/anular', idCuenta, motivo, handleInputErrors, CuentasCobroTorreController.anular)

export default router
