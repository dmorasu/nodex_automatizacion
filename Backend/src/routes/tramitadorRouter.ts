import {Router} from 'express'
import { handleInputErrors } from '../middleware/validation'
import { TramitadorController } from '../controllers/TramitadorController'
import { validateTramitadorExits,validateTramitadorInput } from '../middleware/tramitador'
import { requiereRol } from '../middleware/gastos/requiereRol'

// La sesión y el perfil de trámites se exigen en server.ts
const soloTorreControl = requiereRol('TORRE_CONTROL')
const soloAdmin = requiereRol('ADMIN')

const router =Router()

router.param('tramitadorId',validateTramitadorExits)

router.get('/',TramitadorController.search)

router.post('/',
    soloTorreControl,
    validateTramitadorInput,
    handleInputErrors,
    TramitadorController.create
)

router.get('/tramitadores',TramitadorController.getAll)

// Regiones para la lista desplegable del formulario (va antes de /:tramitadorId)
router.get('/regiones',TramitadorController.regiones)

router.get('/:tramitadorId',
    TramitadorController.getById
)

router.put('/:tramitadorId',
    soloTorreControl,
    validateTramitadorInput,
    handleInputErrors,
    TramitadorController.updateById
)

// Acceso a la app Nodex Tramitadores
router.post('/:tramitadorId/acceso', soloTorreControl, TramitadorController.crearAcceso)
router.delete('/:tramitadorId/acceso', soloTorreControl, TramitadorController.revocarAcceso)

router.delete('/:tramitadorId',
    soloAdmin,
    TramitadorController.deleteById
)

export default router