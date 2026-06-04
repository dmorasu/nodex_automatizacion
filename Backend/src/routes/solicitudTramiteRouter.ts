import { Router } from 'express'
import multer from 'multer'

import { SolicitudTramitesController } from "../controllers/SolicitudTramitesController"
import { EstadosTramitesController } from '../controllers/EstadosTramitesController'
import { TrazabilidadController } from '../controllers/TrazabilidadController'
import { LogisticaController } from '../controllers/LogisticaController'
import { ProgramacionController } from '../controllers/ProgramacionController'
import { CuentaCobroController } from '../controllers/CuentaCobroController'
import {cargaMasivaSolicitudes, generarPlantillaExcel, validarSolicitudesExcel} from '../controllers/CargaMasivaController'
import { handleInputErrors } from '../middleware/validation'
import { validateSolicitudTramiteExits, validateSolicitudTramitesInput } from '../middleware/solicitudTramites'
import { validateTrazabilidadInput, validateTrazabilidadExits } from '../middleware/trazabilidad'
import { validateEstadosTramitesInput, validateEstadosTramitesExits } from '../middleware/estadosTramites'
import { validateLogisticaInput, validateLogisticaId } from '../middleware/logistica'
import { validateProgramacionInput, validateProgramacionExits } from '../middleware/programacion'
import { validateCuentaCobroInput, validateCuentaCobroExits } from '../middleware/cuentaCobro'
import { SubEstadosSolicitudController } from '../controllers/SubEstadosSolicitudController'
import { autenticacion } from '../middleware/auth'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

//--------------------------------------------Ruta de Cargue Masivo ------------------------------------------------------------- 



//------------------------------------Busquedas Dashboard-----------------------------------//

router.get('/buscar', SolicitudTramitesController.buscarSolicitudes)
router.get('/filtrar', SolicitudTramitesController.filtrarSolicitudes)
router.get('/solicitudes', SolicitudTramitesController.obtenerSolicitudes)

//==================== TORRE CONTROL ============//
router.get('/panel-control', SolicitudTramitesController.panelControl)
router.get(
 '/torre-control',
 SolicitudTramitesController.torreControl
)




// ================= PARAMS =================
router.param('solicitudTramitesId', validateSolicitudTramiteExits)
router.param('trazabilidadId', validateTrazabilidadExits)
router.param('estadosTramitesId', validateEstadosTramitesExits)
router.param('logisticaId', validateLogisticaId)
router.param('programacionId', validateProgramacionExits)
router.param('cuentaCobroId', validateCuentaCobroExits)




router.post('/carga-masiva',autenticacion, upload.single('file'), cargaMasivaSolicitudes )
router.get('/plantilla', generarPlantillaExcel) 
router.post('/validar-excel', upload.single('file'), validarSolicitudesExcel )

// ================= SOLICITUDES =================
router.get('/', SolicitudTramitesController.obtenerSolicitudes)

router.post('/',
  validateSolicitudTramitesInput,
  handleInputErrors,
  SolicitudTramitesController.create
)

router.get('/:solicitudTramitesId', SolicitudTramitesController.getById)
router.put('/:solicitudTramitesId',
  validateSolicitudTramitesInput,
  handleInputErrors,
  SolicitudTramitesController.updateById
)
router.delete('/:solicitudTramitesId', SolicitudTramitesController.deleteById)


// ================= TRAZABILIDAD =================
router.post('/:solicitudTramitesId/trazabilidad',
  validateTrazabilidadInput,
  handleInputErrors,
  TrazabilidadController.create
)
router.get('/:solicitudTramitesId/trazabilidad/:trazabilidadId',
  TrazabilidadController.getById
)
router.put('/:solicitudTramitesId/trazabilidad/:trazabilidadId',
  validateTrazabilidadInput,
  handleInputErrors,
  TrazabilidadController.updateById
)
router.delete('/:solicitudTramitesId/trazabilidad/:trazabilidadId',
  TrazabilidadController.deleteById
)



// ================= ESTADOS =================
router.post('/:solicitudTramitesId/estadosTramites',
  validateEstadosTramitesInput,
  handleInputErrors,
  EstadosTramitesController.create
)
router.get('/:solicitudTramitesId/estadosTramites/:estadosTramitesId',
  EstadosTramitesController.getById
)
router.put('/:solicitudTramitesId/estadosTramites/:estadosTramitesId',
  validateEstadosTramitesInput,
  handleInputErrors,
  EstadosTramitesController.updateById
)
router.delete('/:solicitudTramitesId/estadosTramites/:estadosTramitesId',
  EstadosTramitesController.deleteById
)

//================== SUBESTADOS =============
router.post(
  '/:solicitudTramitesId/subEstadosSolicitud',
  validateSolicitudTramiteExits,
  SubEstadosSolicitudController.create
)

// ================= LOGISTICA =================
router.post('/:solicitudTramitesId/logistica',
  validateLogisticaInput,
  handleInputErrors,
  LogisticaController.create
)
router.get('/:solicitudTramitesId/logistica/:logisticaId',
  LogisticaController.getById
)

// ================= PROGRAMACION =================
router.post('/:solicitudTramitesId/programacion',
  validateProgramacionInput,
  handleInputErrors,
  ProgramacionController.create
)
router.get('/:solicitudTramitesId/programacion/:programacionId',
  ProgramacionController.getById
)

// ================= CUENTA COBRO =================
router.post('/:solicitudTramitesId/cuentaCobro',
  validateCuentaCobroInput,
  handleInputErrors,
  CuentaCobroController.create
)
router.get('/:solicitudTramitesId/cuentaCobro/:cuentaCobroId',
  CuentaCobroController.getById
)
//------------------------------------------------Rutas para Tramitador -------------------------------------------------------------------------------- 
router.patch( '/:solicitudTramitesId/asignar-tramitador', validateSolicitudTramiteExits, SolicitudTramitesController.asignarTramitador )

export default router
