import { Router } from 'express'
import multer from 'multer'

import { SolicitudTramitesController } from "../controllers/SolicitudTramitesController"
import { AnalistasTramitesController } from "../controllers/AnalistasTramitesController"
import { EstadosTramitesController } from '../controllers/EstadosTramitesController'
import { TrazabilidadController } from '../controllers/TrazabilidadController'
import { LogisticaController } from '../controllers/LogisticaController'
import { ProgramacionController } from '../controllers/ProgramacionController'
import { CuentaCobroController } from '../controllers/CuentaCobroController'
import {cargaMasivaSolicitudes, generarPlantillaExcel, validarSolicitudesExcel} from '../controllers/CargaMasivaController'
import { CargueMasivoTramitesController } from '../controllers/CargueMasivoTramitesController'
import { handleInputErrors } from '../middleware/validation'
import { validateSolicitudTramiteExits, validateSolicitudTramitesInput } from '../middleware/solicitudTramites'
import { validateTrazabilidadInput, validateTrazabilidadExits } from '../middleware/trazabilidad'
import { validateEstadosTramitesInput, validateEstadosTramitesExits } from '../middleware/estadosTramites'
import { validateLogisticaInput, validateLogisticaId } from '../middleware/logistica'
import { validateProgramacionInput, validateProgramacionExits } from '../middleware/programacion'
import { validateCuentaCobroInput, validateCuentaCobroExits } from '../middleware/cuentaCobro'
import { SubEstadosSolicitudController } from '../controllers/SubEstadosSolicitudController'
import { requiereRol } from '../middleware/gastos/requiereRol'
import { obtenerHistorial } from '../services/historialTramites'
import { ErrorNovedadSubsanada, subsanarNovedad } from '../services/novedadSubsanada'

// La sesión y el perfil (Gestión de activos o Torre de control) se exigen en server.ts.
// Estas acciones son solo de Torre de control:
const soloTorreControl = requiereRol('TORRE_CONTROL')

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

//--------------------------------------------Ruta de Cargue Masivo ------------------------------------------------------------- 



//------------------------------------Busquedas Dashboard-----------------------------------//

// Para Gestión de activos, los listados devuelven solo sus trámites
router.get('/buscar', SolicitudTramitesController.buscarSolicitudes)
router.get('/filtrar', SolicitudTramitesController.filtrarSolicitudes)
router.get('/solicitudes', SolicitudTramitesController.obtenerSolicitudes)

//==================== TORRE CONTROL ============//
// Tablero de gestión: Torre de control (el analista recibe solo sus trámites)
router.get('/tablero', soloTorreControl, SolicitudTramitesController.tablero)
router.get('/tablero/exportar', soloTorreControl, SolicitudTramitesController.exportarTablero)

//==================== ANALISTAS ============//
// Ver la lista de analistas: cualquiera con acceso a trámites. Cambiar asignaciones:
// solo Administrador de Torre de control (y Admin, que siempre pasa)
const soloAdminTorreControl = requiereRol('ADMIN_TORRE_CONTROL')

router.get('/analistas', AnalistasTramitesController.listar)
router.get('/analistas/resumen', soloAdminTorreControl, AnalistasTramitesController.resumen)
router.post('/analistas/reasignar', soloAdminTorreControl, AnalistasTramitesController.reasignar)
router.get('/analistas/municipios', soloAdminTorreControl, AnalistasTramitesController.municipios)
router.put('/analistas/municipios', soloAdminTorreControl, AnalistasTramitesController.asignarMunicipios)




// ================= PARAMS =================
router.param('solicitudTramitesId', validateSolicitudTramiteExits)
router.param('trazabilidadId', validateTrazabilidadExits)
router.param('estadosTramitesId', validateEstadosTramitesExits)
router.param('logisticaId', validateLogisticaId)
router.param('programacionId', validateProgramacionExits)
router.param('cuentaCobroId', validateCuentaCobroExits)




// Cargue masivo en pantalla (trámites y sus gastos; el Excel se importa a la pantalla)
router.get('/cargue/catalogos', CargueMasivoTramitesController.catalogos)
router.get('/cargue/clientes', CargueMasivoTramitesController.clientes)
router.post('/cargue/beneficiarios', CargueMasivoTramitesController.beneficiarios)
router.post('/cargue/validar', CargueMasivoTramitesController.validar)
router.post('/cargue/crear', CargueMasivoTramitesController.crear)
router.get('/cargue/plantilla', CargueMasivoTramitesController.plantilla)
router.post('/cargue/leer-excel', upload.single('file'), CargueMasivoTramitesController.leerExcel)

// Cargue con el Excel de ids (el de siempre)
router.post('/carga-masiva', upload.single('file'), cargaMasivaSolicitudes )
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
// Línea de tiempo: estados, programación, logística, asignaciones, documentos... con quién y cuándo
router.get('/:solicitudTramitesId/historial', async (req, res) => {
  try {
    res.json(await obtenerHistorial(req.solicitudTramites.id))
  } catch (error) {
    console.error('ERROR HISTORIAL DEL TRÁMITE:', error)
    res.status(500).json({ error: 'No se pudo cargar el historial' })
  }
})
router.put('/:solicitudTramitesId',
  validateSolicitudTramitesInput,
  handleInputErrors,
  SolicitudTramitesController.updateById
)
router.delete('/:solicitudTramitesId', soloTorreControl, SolicitudTramitesController.deleteById)


// ================= TRAZABILIDAD =================
router.post('/:solicitudTramitesId/trazabilidad',
  soloTorreControl,
  validateTrazabilidadInput,
  handleInputErrors,
  TrazabilidadController.create
)
router.get('/:solicitudTramitesId/trazabilidad/:trazabilidadId',
  TrazabilidadController.getById
)
router.put('/:solicitudTramitesId/trazabilidad/:trazabilidadId',
  soloTorreControl,
  validateTrazabilidadInput,
  handleInputErrors,
  TrazabilidadController.updateById
)
router.delete('/:solicitudTramitesId/trazabilidad/:trazabilidadId',
  soloTorreControl,
  TrazabilidadController.deleteById
)



// ================= ESTADOS =================
// Quien creó el trámite marca la novedad como subsanada (el único estado que puede cambiar).
// Gestión de activos llega aquí porque la ruta admite su perfil; el servicio exige ser el creador.
router.post('/:solicitudTramitesId/subsanar-novedad', async (req, res) => {
  try {
    await subsanarNovedad({
      solicitudTramiteId: req.solicitudTramites.id,
      usuario: { id: req.usuario.id, nombreUsuario: req.usuario.nombreUsuario },
      fechaEntregaResultado: String(req.body?.fechaEntregaResultado ?? ''),
      observacion: String(req.body?.observacion ?? '')
    })
    res.json('Novedad subsanada')
  } catch (error) {
    if (error instanceof ErrorNovedadSubsanada) return res.status(error.status).json({ error: error.message })
    console.error('ERROR SUBSANAR NOVEDAD:', error)
    res.status(500).json({ error: 'No se pudo marcar la novedad como subsanada' })
  }
})
router.post('/:solicitudTramitesId/estadosTramites',
  soloTorreControl,
  validateEstadosTramitesInput,
  handleInputErrors,
  EstadosTramitesController.create
)
router.get('/:solicitudTramitesId/estadosTramites/:estadosTramitesId',
  EstadosTramitesController.getById
)
router.put('/:solicitudTramitesId/estadosTramites/:estadosTramitesId',
  soloTorreControl,
  validateEstadosTramitesInput,
  handleInputErrors,
  EstadosTramitesController.updateById
)
router.delete('/:solicitudTramitesId/estadosTramites/:estadosTramitesId',
  soloTorreControl,
  EstadosTramitesController.deleteById
)

//================== SUBESTADOS =============
router.post(
  '/:solicitudTramitesId/subEstadosSolicitud',
  soloTorreControl,
  validateSolicitudTramiteExits,
  SubEstadosSolicitudController.create
)

// ================= LOGISTICA =================
router.post('/:solicitudTramitesId/logistica',
  soloTorreControl,
  validateLogisticaInput,
  handleInputErrors,
  LogisticaController.create
)
router.get('/:solicitudTramitesId/logistica/:logisticaId',
  LogisticaController.getById
)

// ================= PROGRAMACION =================
router.post('/:solicitudTramitesId/programacion',
  soloTorreControl,
  validateProgramacionInput,
  handleInputErrors,
  ProgramacionController.create
)
router.get('/:solicitudTramitesId/programacion/:programacionId',
  ProgramacionController.getById
)

// ================= CUENTA COBRO =================
router.post('/:solicitudTramitesId/cuentaCobro',
  soloTorreControl,
  validateCuentaCobroInput,
  handleInputErrors,
  CuentaCobroController.create
)
router.get('/:solicitudTramitesId/cuentaCobro/:cuentaCobroId',
  CuentaCobroController.getById
)
//------------------------------------------------Rutas para Tramitador -------------------------------------------------------------------------------- 
router.patch( '/:solicitudTramitesId/asignar-tramitador', soloTorreControl, validateSolicitudTramiteExits, SolicitudTramitesController.asignarTramitador )
router.patch('/:solicitudTramitesId/analista', soloAdminTorreControl, AnalistasTramitesController.asignar)

export default router
