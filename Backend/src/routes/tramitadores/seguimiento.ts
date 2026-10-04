import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { handleInputErrors } from '../../middleware/validation'
import { SeguimientoTramitadorController } from '../../controllers/tramitadores/TramitesTramitadorController'

// Nodex Trámites: comentarios con los tramitadores y trámites reportados como realizados.
// La sesión y el perfil de trámites se exigen en server.ts
const router = Router()

const id = param('id').isInt({ min: 1 }).withMessage('Identificador no válido')

router.get('/tramites/:id', id, handleInputErrors, SeguimientoTramitadorController.seguimiento)

router.post('/tramites/:id/comentarios',
  id,
  body('comentario').isString().trim()
    .notEmpty().withMessage('Escriba el comentario')
    .isLength({ max: 1000 }).withMessage('El comentario no puede superar 1000 caracteres'),
  handleInputErrors,
  SeguimientoTramitadorController.comentar
)

router.get('/reportes-realizado',
  query('estado').optional().isIn(['PENDIENTE', 'REVISADO']).withMessage('Estado no válido'),
  handleInputErrors,
  SeguimientoTramitadorController.reportes
)

router.post('/reportes-realizado/:id/revisar',
  id,
  body('nota').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }).withMessage('La nota no puede superar 1000 caracteres'),
  handleInputErrors,
  SeguimientoTramitadorController.revisar
)

export default router
