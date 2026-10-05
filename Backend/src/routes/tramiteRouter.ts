import {Router}  from 'express'

import { TramiteController } from '../controllers/TramiteController'

import { validateTramitesExits } from '../middleware/tramite'

// Solo consulta. Crear, editar y borrar: /api/catalogos-tramites (con permiso y sin borrar
// tipos de trámite en uso)
const router =Router()

router.param('tramiteId',validateTramitesExits)


router.get('/',TramiteController.getAll)

router.get('/:tramiteId',
    TramiteController.getById
)


export default router
