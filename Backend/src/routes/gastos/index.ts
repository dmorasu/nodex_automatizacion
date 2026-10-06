import { Router } from 'express'
import { autenticacion } from '../../middleware/auth'
import { handleInputErrors } from '../../middleware/validation'
import { requiereRol } from '../../middleware/gastos/requiereRol'
import {
  validarCrearCatalogo,
  validarActualizarCatalogo,
  validarActualizarParametro,
  validarAsignarRoles,
  validarCrearUsuario,
  validarActualizarUsuario,
  validarRestablecerContrasena,
  validarCatalogo
} from '../../middleware/gastos/validacionesAdmin'
import { ROLES } from '../../services/gastos/constantes'
import { CatalogosGastosController } from '../../controllers/gastos/CatalogosGastosController'
import { ParametrosGastosController } from '../../controllers/gastos/ParametrosGastosController'
import { RolesGastosController } from '../../controllers/gastos/RolesGastosController'
import { SolicitudesGastoController } from '../../controllers/gastos/SolicitudesGastoController'
import { DocumentosGastoController } from '../../controllers/gastos/DocumentosGastoController'
import { ApoyoGastosController } from '../../controllers/gastos/ApoyoGastosController'
import { BolsasController } from '../../controllers/gastos/BolsasController'
import { PagosController } from '../../controllers/gastos/PagosController'
import { CuentasCobroController } from '../../controllers/gastos/CuentasCobroController'
import { ReintegrosController } from '../../controllers/gastos/ReintegrosController'
import { ContabilidadController } from '../../controllers/gastos/ContabilidadController'
import { TableroController } from '../../controllers/gastos/TableroController'
import { CargueMasivoGastosController, recibirExcel } from '../../controllers/gastos/CargueMasivoGastosController'
import {
  validarAgregarGastos,
  validarContabilizacion,
  validarContabilizacionGastos,
  validarFiltrosReporte,
  validarFiltrosTablero,
  validarFiltrosReintegrosTramitador,
  validarEgreso,
  validarCuentaCobro,
  validarLegalizar,
  validarFactura,
  validarReintegrar,
  validarAjuste,
  validarProgramacion,
  validarPagoDirecto,
  validarAprobacionLote,
  validarSalidaLote,
  validarConfirmacionPago,
  validarRecarga,
  validarAnulacion,
  validarBolsa,
  validarCrearBolsa,
  validarGasto,
  validarId,
  validarListado,
  validarListadoLotes
} from '../../middleware/gastos/validacionesSolicitud'
import { recibirDocumentos } from '../../middleware/gastos/uploadDocumentosGasto'
import { RevisionSoportesController } from '../../controllers/tramitadores/SoportesTramitadorController'
import { body } from 'express-validator'

// =====================================
// MÓDULO DE GASTOS  →  /api/gastos
// Todas las rutas requieren sesión iniciada.
// =====================================

const router = Router()

router.use(autenticacion)


// ── Sesión ──────────────────────────
router.get('/me', RolesGastosController.me)


// ── Catálogos y parámetros (lectura) ─
router.get('/catalogos', CatalogosGastosController.getAll)
router.get('/parametros', ParametrosGastosController.getAll)


// ── Apoyo para formularios ──────────
router.get('/apoyo/operaciones', ApoyoGastosController.operaciones)
router.get('/apoyo/tramitadores', ApoyoGastosController.tramitadores)
router.get('/apoyo/bolsas', ApoyoGastosController.bolsas)
router.get('/apoyo/tramites/:id', validarId, handleInputErrors, ApoyoGastosController.tramite)
router.get('/terceros', ApoyoGastosController.terceros)


// ── Gastos de un trámite (frontend de trámites) ──
router.get('/tramites/:id/gastos',
  requiereRol(ROLES.GESTION_ACTIVOS, ROLES.TORRE_CONTROL, ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD),
  validarId,
  handleInputErrors,
  SolicitudesGastoController.porTramite
)


// ── Cargue masivo de gastos (desde Nodex Trámites, Gestión de activos) ──
const cargueMasivo = requiereRol(ROLES.GESTION_ACTIVOS)

router.get('/cargue-masivo/plantilla', cargueMasivo, CargueMasivoGastosController.plantilla)
router.post('/cargue-masivo/validar', cargueMasivo, recibirExcel, CargueMasivoGastosController.validar)
router.post('/cargue-masivo/cargar', cargueMasivo, recibirExcel, CargueMasivoGastosController.cargar)


// ── Solicitudes de gasto ────────────
// Cualquier usuario crea gastos; ver todos, editar y anular se valida en el controlador
router.get('/solicitudes', validarListado, handleInputErrors, SolicitudesGastoController.getAll)
router.post('/solicitudes', validarGasto, handleInputErrors, SolicitudesGastoController.create)
router.get('/solicitudes/:id', validarId, handleInputErrors, SolicitudesGastoController.getById)
router.put('/solicitudes/:id', validarId, validarGasto, handleInputErrors, SolicitudesGastoController.update)
router.post('/solicitudes/:id/anular', validarAnulacion, handleInputErrors, SolicitudesGastoController.anular)


// ── Documentos ──────────────────────
router.post('/solicitudes/:id/documentos', recibirDocumentos, validarId, handleInputErrors, DocumentosGastoController.subir)
router.get('/documentos/:documentoId/ver', DocumentosGastoController.ver)
// Descarga masiva (ZIP): los roles del módulo que revisan documentos
router.post('/documentos/descargar',
  requiereRol(ROLES.LEGALIZACION, ROLES.CONTABILIDAD, ROLES.TESORERIA),
  body('gastoIds').isArray({ min: 1, max: 50 }).withMessage('Seleccione entre 1 y 50 gastos'),
  body('gastoIds.*').isInt({ min: 1 }).withMessage('Gasto no válido'),
  handleInputErrors,
  DocumentosGastoController.descargarVarios
)
router.delete('/documentos/:documentoId', DocumentosGastoController.eliminar)


// ── Bolsas (Tesorería) ──────────────
const soloTesoreria = requiereRol(ROLES.TESORERIA)
const soloAdmin = requiereRol(ROLES.ADMIN)
// Usuarios: Admin todo; Administrador de Torre de control solo perfiles de trámites (lo limita el controlador)
const administraUsuarios = requiereRol(ROLES.ADMIN_TORRE_CONTROL)

// Tesorería - Certificados también consulta los saldos (paga desde las bolsas)
const tesoreriaOCertificados = requiereRol(ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS)
router.get('/bolsas', tesoreriaOCertificados, BolsasController.getAll)
router.post('/bolsas', soloTesoreria, validarCrearBolsa, handleInputErrors, BolsasController.create)
router.put('/bolsas/:id', soloTesoreria, validarId, validarBolsa, handleInputErrors, BolsasController.update)
router.get('/bolsas/:id/movimientos', soloTesoreria, validarId, handleInputErrors, BolsasController.movimientos)
router.post('/bolsas/:id/recargas', soloTesoreria, validarRecarga, handleInputErrors, BolsasController.recargar)
router.post('/bolsas/:id/ajustes', soloAdmin, validarAjuste, handleInputErrors, BolsasController.ajustar)


// ── Pagos: Tesorería programa → Dirección de Negocio aprueba → Tesorería confirma ──
// Quién paga qué (general o certificados) se valida en el controlador
const soloDireccion = requiereRol(ROLES.DIRECCION_NEGOCIO)
router.post('/lotes', tesoreriaOCertificados, validarProgramacion, handleInputErrors, PagosController.programar)
// Compras de certificados: pago directo, sin aprobación de Dirección
router.post('/pagos', tesoreriaOCertificados, validarPagoDirecto, handleInputErrors, PagosController.pagarCertificados)
router.post('/lotes/:id/aprobar', soloDireccion, validarAprobacionLote, handleInputErrors, PagosController.aprobar)
router.post('/lotes/:id/rechazar', soloDireccion, validarSalidaLote, handleInputErrors, PagosController.rechazar)
router.post('/lotes/:id/quitar', tesoreriaOCertificados, validarSalidaLote, handleInputErrors, PagosController.quitar)
router.post('/lotes/:id/confirmar', tesoreriaOCertificados, validarConfirmacionPago, handleInputErrors, PagosController.confirmar)
// Contabilidad también consulta los pagos para registrarles el número de egreso
const verLotes = requiereRol(ROLES.TESORERIA, ROLES.TESORERIA_CERTIFICADOS, ROLES.CONTABILIDAD, ROLES.DIRECCION_NEGOCIO)
router.get('/lotes', verLotes, validarListadoLotes, handleInputErrors, PagosController.getLotes)
router.get('/lotes/:id', verLotes, validarId, handleInputErrors, PagosController.getLote)
router.post('/lotes/:id/documentos', tesoreriaOCertificados, recibirDocumentos, validarId, handleInputErrors, DocumentosGastoController.subirALote)


// ── Legalización ────────────────────
const soloLegalizacion = requiereRol(ROLES.LEGALIZACION)
// Contabilidad y Tesorería también consultan las cuentas de cobro
const verCuentas = requiereRol(ROLES.LEGALIZACION, ROLES.CONTABILIDAD, ROLES.TESORERIA)
// Tesorería también puede legalizar (marcar como legalizada) una cuenta de cobro
const legalizarCuentas = requiereRol(ROLES.LEGALIZACION, ROLES.TESORERIA)

// Factura real: con ella se calcula la retención, el 4x1000 y el reintegro
// Legalización (reembolsables) o Contabilidad (no reembolsables): se valida en el controlador
const gestionFactura = requiereRol(ROLES.LEGALIZACION, ROLES.CONTABILIDAD)
router.put('/solicitudes/:id/factura', gestionFactura, validarFactura, handleInputErrors, SolicitudesGastoController.registrarFactura)

router.get('/cuentas-cobro', verCuentas, CuentasCobroController.getAll)
router.post('/cuentas-cobro', soloLegalizacion, validarCuentaCobro, handleInputErrors, CuentasCobroController.create)
router.get('/cuentas-cobro/:id', verCuentas, validarId, handleInputErrors, CuentasCobroController.getById)
router.put('/cuentas-cobro/:id', soloLegalizacion, validarId, validarCuentaCobro, handleInputErrors, CuentasCobroController.update)
router.post('/cuentas-cobro/:id/gastos', soloLegalizacion, validarAgregarGastos, handleInputErrors, CuentasCobroController.agregarGastos)
router.delete('/cuentas-cobro/:id/gastos/:lineaId', soloLegalizacion, validarId, handleInputErrors, CuentasCobroController.quitarLinea)
router.post('/cuentas-cobro/:id/legalizar', legalizarCuentas, validarLegalizar, handleInputErrors, CuentasCobroController.legalizar)
router.post('/cuentas-cobro/:id/anular', soloLegalizacion, validarAnulacion, handleInputErrors, CuentasCobroController.anular)
router.post('/cuentas-cobro/:id/documentos', soloLegalizacion, recibirDocumentos, validarId, handleInputErrors, DocumentosGastoController.subirACuenta)

router.get('/reintegros', soloLegalizacion, ReintegrosController.getAll)
router.post('/reintegros/:id/reintegrar', soloLegalizacion, validarReintegrar, handleInputErrors, ReintegrosController.reintegrar)
router.post('/reintegros/:id/documentos', soloLegalizacion, recibirDocumentos, validarId, handleInputErrors, DocumentosGastoController.subirAReintegro)

// Soportes que suben los tramitadores desde su app (facturas y comprobantes de reintegro)
// Legalización revisa los de gastos reembolsables y Contabilidad los de no reembolsables
router.get('/soportes-tramitador', gestionFactura, RevisionSoportesController.listar)
router.get('/soportes-tramitador/archivos/:id/ver', gestionFactura, validarId, handleInputErrors, RevisionSoportesController.verArchivo)
router.post('/soportes-tramitador/:id/aprobar',
  gestionFactura,
  validarId,
  body('fechaReintegro').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida'),
  handleInputErrors,
  RevisionSoportesController.aprobar
)
router.post('/soportes-tramitador/:id/rechazar',
  gestionFactura,
  validarId,
  body('motivo').isString().trim()
    .notEmpty().withMessage('Indique el motivo del rechazo')
    .isLength({ max: 1000 }).withMessage('El motivo no puede superar 1000 caracteres'),
  handleInputErrors,
  RevisionSoportesController.rechazar
)


// ── Contabilidad ────────────────────
const soloContabilidad = requiereRol(ROLES.CONTABILIDAD)

router.put('/lotes/:id/egreso', soloContabilidad, validarEgreso, handleInputErrors, ContabilidadController.registrarEgreso)
router.post('/contabilidad/contabilizar', soloContabilidad, validarContabilizacion, handleInputErrors, ContabilidadController.contabilizar)
router.post('/contabilidad/contabilizar-gastos', soloContabilidad, validarContabilizacionGastos, handleInputErrors, ContabilidadController.contabilizarGastos)


// ── Tablero y reportes ──────────────
const verTablero = requiereRol(ROLES.TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD)

router.get('/tablero', verTablero, validarFiltrosTablero, handleInputErrors, TableroController.getTablero)
router.get('/reintegros-tramitador', verTablero, validarFiltrosReintegrosTramitador, handleInputErrors, TableroController.getReintegrosPorTramitador)
router.get('/reportes/gastos', verTablero, validarFiltrosReporte, handleInputErrors, TableroController.exportarGastos)


// ── Administración ──────────────────

router.get('/admin/roles', administraUsuarios, RolesGastosController.getRoles)
router.get('/admin/usuarios', administraUsuarios, RolesGastosController.getUsuarios)
router.post('/admin/usuarios', administraUsuarios, validarCrearUsuario, handleInputErrors, RolesGastosController.crearUsuario)
router.put('/admin/usuarios/:usuarioId', administraUsuarios, validarActualizarUsuario, handleInputErrors, RolesGastosController.actualizarUsuario)
router.put('/admin/usuarios/:usuarioId/contrasena', administraUsuarios, validarRestablecerContrasena, handleInputErrors, RolesGastosController.restablecerContrasena)
router.put('/admin/usuarios/:usuarioId/roles',
  administraUsuarios,
  validarAsignarRoles,
  handleInputErrors,
  RolesGastosController.asignarRoles
)

router.get('/admin/catalogos/:catalogo',
  soloAdmin,
  validarCatalogo,
  handleInputErrors,
  CatalogosGastosController.getCatalogo
)
router.post('/admin/catalogos/:catalogo',
  soloAdmin,
  validarCrearCatalogo,
  handleInputErrors,
  CatalogosGastosController.create
)
router.put('/admin/catalogos/:catalogo/:id',
  soloAdmin,
  validarActualizarCatalogo,
  handleInputErrors,
  CatalogosGastosController.update
)

router.put('/admin/parametros/:clave',
  soloAdmin,
  validarActualizarParametro,
  handleInputErrors,
  ParametrosGastosController.update
)


export default router
