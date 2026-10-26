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
  validarCatalogo,
  validarEliminarCatalogo
} from '../../middleware/gastos/validacionesAdmin'
import { ROLES } from '../../services/gastos/constantes'
import { FILTROS_ARQUEO, ORDENES_ARQUEO } from '../../services/gastos/anticipos'
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
  validarConfirmacionPagos,
  validarRecarga,
  validarAnulacion,
  validarBolsa,
  validarCrearBolsa,
  validarGasto,
  validarId,
  validarListado,
  validarListadoLotes
} from '../../middleware/gastos/validacionesSolicitud'
import { recibirDocumentos, recibirFacturas, recibirSoportesPago } from '../../middleware/gastos/uploadDocumentosGasto'
import { AnticiposController, ClientesEmpresarialesController } from '../../controllers/gastos/AnticiposController'
import {
  leerDatosJson,
  validarAnticipo,
  validarConfirmacionAnticipos,
  validarFacturacion,
  validarListadoAnticipos,
  validarMotivo
} from '../../middleware/gastos/validacionesAnticipos'
import { CajaMenorController } from '../../controllers/gastos/CajaMenorController'
import {
  validarActualizarCaja,
  validarAsignacion,
  validarCaja,
  validarGastosReembolso,
  validarHistorialCaja,
  validarLegalizacionCaja,
  validarLegalizacionReembolso,
  validarListadoReembolsos,
  validarNuevoReembolso,
  validarPagoCaja
} from '../../middleware/gastos/validacionesCajaMenor'
import { RevisionSoportesController } from '../../controllers/tramitadores/SoportesTramitadorController'
import { body, param, query } from 'express-validator'

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
  requiereRol(ROLES.GESTION_ACTIVOS, ROLES.TORRE_CONTROL, ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA, ROLES.LEGALIZACION, ROLES.CONTABILIDAD),
  validarId,
  handleInputErrors,
  SolicitudesGastoController.porTramite
)


// ── Cargue masivo de gastos (Nodex Trámites y Nodex Gastos) ──
// Como crear un gasto uno a uno: cualquier usuario. Gestión de activos sigue limitado a
// los trámites de su área (lo valida el servicio)
router.get('/cargue-masivo/plantilla', CargueMasivoGastosController.plantilla)
router.post('/cargue-masivo/validar', recibirExcel, CargueMasivoGastosController.validar)
router.post('/cargue-masivo/cargar', recibirExcel, CargueMasivoGastosController.cargar)


// ── Solicitudes de gasto ────────────
// Cualquier usuario crea gastos; ver todos, editar y anular se valida en el controlador
router.get('/solicitudes', validarListado, handleInputErrors, SolicitudesGastoController.getAll)
router.post('/solicitudes', validarGasto, handleInputErrors, SolicitudesGastoController.create)
// Antes de /solicitudes/:id: CSV con los mismos filtros del listado
router.get('/solicitudes/exportar', validarListado, handleInputErrors, SolicitudesGastoController.exportar)
router.get('/solicitudes/:id', validarId, handleInputErrors, SolicitudesGastoController.getById)
router.put('/solicitudes/:id', validarId, validarGasto, handleInputErrors, SolicitudesGastoController.update)
router.post('/solicitudes/:id/anular', validarAnulacion, handleInputErrors, SolicitudesGastoController.anular)


// ── Anticipos de clientes del banco ──
// Cualquier usuario los registra (como los gastos); Contabilidad confirma o devuelve con novedad.
// Ver, corregir y anular se valida en el controlador.
const contabilidadAnticipos = requiereRol(ROLES.CONTABILIDAD)
router.get('/anticipos', validarListadoAnticipos, handleInputErrors, AnticiposController.listar)
router.get('/anticipos/resumen', AnticiposController.resumen)
router.post('/anticipos', recibirDocumentos, leerDatosJson, validarAnticipo, handleInputErrors, AnticiposController.crear)
router.post('/anticipos/confirmar', contabilidadAnticipos, validarConfirmacionAnticipos, handleInputErrors, AnticiposController.confirmar)
router.post('/anticipos/facturar', contabilidadAnticipos, recibirFacturas, leerDatosJson, validarFacturacion, handleInputErrors, AnticiposController.facturar)
router.get('/anticipos/:id', validarId, handleInputErrors, AnticiposController.detalle)
router.put('/anticipos/:id', recibirDocumentos, leerDatosJson, validarId, validarAnticipo, handleInputErrors, AnticiposController.actualizar)
router.post('/anticipos/:id/anular', validarId, validarMotivo, handleInputErrors, AnticiposController.anular)
router.post('/anticipos/:id/novedad', contabilidadAnticipos, validarId, validarMotivo, handleInputErrors, AnticiposController.novedad)

// Clientes empresariales (ej: Davivienda): los ve todo el que registra anticipos.
// Los crea y edita solo el Administrador en Catálogos (/admin/catalogos/clientesEmpresariales)
router.get('/clientes-empresariales', ClientesEmpresarialesController.listar)


// ── Documentos ──────────────────────
router.post('/solicitudes/:id/documentos', recibirDocumentos, validarId, handleInputErrors, DocumentosGastoController.subir)
router.get('/documentos/:documentoId/ver', DocumentosGastoController.ver)
// Descarga masiva (ZIP): los roles del módulo que revisan documentos
const validarGastosDescarga = [
  requiereRol(ROLES.LEGALIZACION, ROLES.CONTABILIDAD, ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA),
  body('gastoIds').isArray({ min: 1, max: 50 }).withMessage('Seleccione entre 1 y 50 gastos'),
  body('gastoIds.*').isInt({ min: 1 }).withMessage('Gasto no válido')
]
router.post('/documentos/descargar/revision', validarGastosDescarga, handleInputErrors, DocumentosGastoController.revisionPdfsDePago)
router.post('/documentos/descargar',
  validarGastosDescarga,
  body('pdfPago.*').optional().isIn(['SOPORTE', 'FACTURA', 'AMBOS']).withMessage('Elección del PDF de pago no válida'),
  handleInputErrors,
  DocumentosGastoController.descargarVarios
)
router.delete('/documentos/:documentoId', DocumentosGastoController.eliminar)


// ── Bolsas (Tesorería) ──────────────
// Crear, editar, recargar y ver movimientos de bolsas (y configurar cajas): solo Tesorería. El
// Analista de Tesorería no administra bolsas, pero las ve en la lista al pagar
const soloTesoreria = requiereRol(ROLES.TESORERIA)
const soloAdmin = requiereRol(ROLES.ADMIN)
// Usuarios: cada administrador maneja los perfiles de su app (lo limita el controlador)
const administraUsuarios = requiereRol(ROLES.ADMIN_GASTOS, ROLES.ADMIN_TRAMITES, ROLES.ADMIN_TORRE_CONTROL)

// Tesorería - Certificados también consulta los saldos (paga desde las bolsas)
const tesoreriaOCertificados = requiereRol(ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA, ROLES.TESORERIA_CERTIFICADOS)
router.get('/bolsas', tesoreriaOCertificados, BolsasController.getAll)
router.post('/bolsas', soloTesoreria, validarCrearBolsa, handleInputErrors, BolsasController.create)
router.put('/bolsas/:id', soloTesoreria, validarId, validarBolsa, handleInputErrors, BolsasController.update)
router.get('/bolsas/:id/movimientos', soloTesoreria, validarId, handleInputErrors, BolsasController.movimientos)
// Saldo de cada cliente en una bolsa de anticipos (Tesorería y Contabilidad)
// Arqueo: Tesorería y Contabilidad
const verArqueo = requiereRol(ROLES.TESORERIA, ROLES.CONTABILIDAD)
const filtrosArqueo = [
  query('filtro').optional({ values: 'falsy' }).isIn(FILTROS_ARQUEO).withMessage('Filtro no válido'),
  query('orden').optional({ values: 'falsy' }).isIn(ORDENES_ARQUEO).withMessage('Orden no válido'),
  query('busqueda').optional().isString().isLength({ max: 100 }),
  query('pagina').optional().isInt({ min: 1 }),
  query('tamano').optional().isInt({ min: 1, max: 200 })
]
const periodoArqueo = [
  validarId,
  param('clienteId').isInt({ min: 1 }).withMessage('Cliente no válido'),
  query(['desde', 'hasta']).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fecha no válida')
]
router.get('/bolsas/:id/clientes', verArqueo, validarId, ...filtrosArqueo, handleInputErrors, BolsasController.clientes)
router.get('/bolsas/:id/clientes/exportar', verArqueo, validarId, ...filtrosArqueo, handleInputErrors, BolsasController.exportarArqueo)
// Estado de cuenta de un cliente (movimientos con saldo corrido, por pagar y anticipos)
router.get('/bolsas/:id/clientes/:clienteId', verArqueo, ...periodoArqueo, handleInputErrors, BolsasController.estadoDeCuenta)
router.get('/bolsas/:id/clientes/:clienteId/exportar', verArqueo, ...periodoArqueo, handleInputErrors, BolsasController.exportarEstadoCuenta)
router.post('/bolsas/:id/recargas', soloTesoreria, validarRecarga, handleInputErrors, BolsasController.recargar)
router.post('/bolsas/:id/ajustes', soloAdmin, validarAjuste, handleInputErrors, BolsasController.ajustar)


// ── Pagos: Tesorería programa → Dirección de Negocio aprueba → Tesorería confirma ──
// Quién paga qué (general o certificados) se valida en el controlador
const soloDireccion = requiereRol(ROLES.DIRECCION_NEGOCIO)
router.post('/lotes', tesoreriaOCertificados, validarProgramacion, handleInputErrors, PagosController.programar)
// Compras de certificados: pago directo, sin aprobación de Dirección
// multipart: datos (JSON) + soporte_<gastoId> por cada gasto (obligatorio) + archivos del banco (opcional)
router.post('/pagos', tesoreriaOCertificados, recibirSoportesPago, leerDatosJson, validarPagoDirecto, handleInputErrors, PagosController.pagarCertificados)
router.post('/lotes/:id/aprobar', soloDireccion, validarAprobacionLote, handleInputErrors, PagosController.aprobar)
router.post('/lotes/:id/rechazar', soloDireccion, validarSalidaLote, handleInputErrors, PagosController.rechazar)
router.post('/lotes/:id/quitar', tesoreriaOCertificados, validarSalidaLote, handleInputErrors, PagosController.quitar)
router.post('/lotes/:id/confirmar', tesoreriaOCertificados, validarConfirmacionPago, handleInputErrors, PagosController.confirmar)
// Uno o varios lotes aprobados a la vez, adjuntando el soporte del banco en el mismo paso
// (multipart: datos = JSON con loteIds, fechaPago y observacion; archivos[])
router.post('/lotes/confirmar', tesoreriaOCertificados, recibirSoportesPago, leerDatosJson, validarConfirmacionPagos, handleInputErrors, PagosController.confirmarVarios)
// Contabilidad también consulta los pagos para registrarles el número de egreso
const verLotes = requiereRol(ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA, ROLES.TESORERIA_CERTIFICADOS, ROLES.CONTABILIDAD, ROLES.DIRECCION_NEGOCIO)
router.get('/lotes', verLotes, validarListadoLotes, handleInputErrors, PagosController.getLotes)
router.get('/lotes/:id', verLotes, validarId, handleInputErrors, PagosController.getLote)
router.post('/lotes/:id/documentos', tesoreriaOCertificados, recibirDocumentos, validarId, handleInputErrors, DocumentosGastoController.subirALote)


// ── Legalización ────────────────────
const soloLegalizacion = requiereRol(ROLES.LEGALIZACION)
// Contabilidad y Tesorería también consultan las cuentas de cobro
const verCuentas = requiereRol(ROLES.LEGALIZACION, ROLES.CONTABILIDAD, ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA)
// Tesorería también puede legalizar (marcar como legalizada) una cuenta de cobro
const legalizarCuentas = requiereRol(ROLES.LEGALIZACION, ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA)

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
// El Analista de Tesorería no ve Indicadores ni Reportes (decisión del usuario)
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
router.post('/admin/usuarios/:usuarioId/desbloquear', administraUsuarios, RolesGastosController.desbloquear)
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
router.delete('/admin/catalogos/:catalogo/:id',
  soloAdmin,
  validarEliminarCatalogo,
  handleInputErrors,
  CatalogosGastosController.remove
)

router.put('/admin/parametros/:clave',
  soloAdmin,
  validarActualizarParametro,
  handleInputErrors,
  ParametrosGastosController.update
)


// =====================================
// CAJA MENOR
// Tesorería maneja todas las cajas; la Auxiliar de Tesorería - Caja menor, solo la suya (lo
// verifica el controlador). Dirección de Negocio aprueba los reembolsos.
// =====================================
const tesoreriaCaja = requiereRol(ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA, ROLES.AUXILIAR_TESORERIA_CAJA)
const cajaODireccion = requiereRol(ROLES.TESORERIA, ROLES.ANALISTA_TESORERIA, ROLES.AUXILIAR_TESORERIA_CAJA, ROLES.DIRECCION_NEGOCIO)

router.get('/caja-menor/cajas', tesoreriaCaja, CajaMenorController.cajas)
router.get('/caja-menor/cajas/:id/historial', tesoreriaCaja, validarHistorialCaja, handleInputErrors, CajaMenorController.historial)
router.get('/caja-menor/cajas/:id/historial/exportar', tesoreriaCaja, validarHistorialCaja, handleInputErrors, CajaMenorController.exportarHistorial)
router.post('/caja-menor/cajas', soloTesoreria, validarCaja, handleInputErrors, CajaMenorController.crearCaja)
router.put('/caja-menor/cajas/:id', soloTesoreria, validarActualizarCaja, handleInputErrors, CajaMenorController.actualizarCaja)
router.get('/caja-menor/usuarios', soloTesoreria, CajaMenorController.usuarios)
router.put('/caja-menor/usuarios/:usuarioId', soloTesoreria, validarAsignacion, handleInputErrors, CajaMenorController.asignar)

router.post('/caja-menor/pagar', tesoreriaCaja, validarPagoCaja, handleInputErrors, CajaMenorController.pagar)
router.post('/caja-menor/gastos/:id/legalizar', tesoreriaCaja, recibirDocumentos, leerDatosJson, validarLegalizacionCaja, handleInputErrors, CajaMenorController.legalizarGasto)
router.post('/caja-menor/gastos/:id/deshacer', tesoreriaCaja, validarId, handleInputErrors, CajaMenorController.deshacerLegalizacion)

router.get('/caja-menor/reembolsos', cajaODireccion, validarListadoReembolsos, handleInputErrors, CajaMenorController.reembolsos)
router.post('/caja-menor/reembolsos', tesoreriaCaja, validarNuevoReembolso, handleInputErrors, CajaMenorController.crearReembolso)
router.get('/caja-menor/reembolsos/:id', cajaODireccion, validarId, handleInputErrors, CajaMenorController.reembolso)
router.post('/caja-menor/reembolsos/:id/agregar', tesoreriaCaja, validarGastosReembolso, handleInputErrors, CajaMenorController.agregar)
router.post('/caja-menor/reembolsos/:id/quitar', tesoreriaCaja, validarGastosReembolso, handleInputErrors, CajaMenorController.quitar)
router.post('/caja-menor/reembolsos/:id/enviar', tesoreriaCaja, validarId, handleInputErrors, CajaMenorController.enviar)
router.post('/caja-menor/reembolsos/:id/anular', tesoreriaCaja, validarId, handleInputErrors, CajaMenorController.anular)
router.post('/caja-menor/reembolsos/:id/aprobar', soloDireccion, validarId, handleInputErrors, CajaMenorController.aprobar)
router.post('/caja-menor/reembolsos/:id/rechazar', soloDireccion, validarId, validarMotivo, handleInputErrors, CajaMenorController.rechazar)
router.post('/caja-menor/reembolsos/:id/legalizar', tesoreriaCaja, recibirDocumentos, leerDatosJson, validarLegalizacionReembolso, handleInputErrors, CajaMenorController.legalizar)


export default router
