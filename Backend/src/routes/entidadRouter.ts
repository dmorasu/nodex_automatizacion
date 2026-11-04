import {Router}  from 'express'

import { EntidadController } from '../controllers/EntidadController'

import { validateEntidadExits } from '../middleware/entidad'



const router =Router()

router.param('entidadId',validateEntidadExits)

// Solo consulta. Las entidades se crean, renombran y eliminan en Catálogos
// (/api/catalogos-tramites/entidades, solo administradores): Entidades → SolicitudTramites es
// ON DELETE CASCADE, y el DELETE que había aquí, abierto a cualquiera con sesión, borraba los trámites
router.get('/',EntidadController.getAll)

router.get('/:entidadId',
    EntidadController.getById
)


export default router
