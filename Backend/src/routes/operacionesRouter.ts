import {Router}  from 'express'

import { OperacionesController } from '../controllers/OperacionesController'

import { validateOperacionesExits } from '../middleware/operaciones'

// Solo consulta. Crear, editar y borrar: /api/catalogos-tramites (con permiso y sin borrar
// operaciones en uso: la relación con los trámites tiene onDelete CASCADE)
const router =Router()

router.param('operacionesId',validateOperacionesExits)


router.get('/',OperacionesController.getAll)

router.get('/:operacionesId',
    OperacionesController.getById
)


export default router
