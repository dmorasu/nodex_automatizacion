import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { handleInputErrors } from '../../middleware/validation'
import { contrasenaSegura } from '../../utils/politicaContrasena'
import { autenticacionTramitador, exigirContrasenaDefinitiva } from '../../middleware/tramitadores/autenticacionTramitador'
import { AuthTramitadorController } from '../../controllers/tramitadores/AuthTramitadorController'
import { TramitesTramitadorController } from '../../controllers/tramitadores/TramitesTramitadorController'
import { GastosTramitadorController } from '../../controllers/tramitadores/SoportesTramitadorController'
import { recibirDocumentos } from '../../middleware/gastos/uploadDocumentosGasto'
import { TIPOS_DOCUMENTO_TRAMITE } from '../../services/tramitadores/nombresDocumento'
import { RutaMensajeroController, recibirFoto } from '../../controllers/tramitadores/RutaMensajeroController'
import { NotificacionesTramitadorController } from '../../controllers/tramitadores/NotificacionesTramitadorController'

// API de la app Nodex Tramitadores (/api/app-tramitadores).
// Usa su propio token: los tokens de usuarios internos no sirven aquí ni al revés.
const router = Router()

// ── Sesión ──────────────
router.post('/auth/login',
  body('identificacion').isString().trim().notEmpty().withMessage('Ingrese su identificación').isLength({ max: 50 }),
  body('contrasena').isString().notEmpty().withMessage('Ingrese su contraseña').isLength({ max: 100 }),
  handleInputErrors,
  AuthTramitadorController.login
)

router.get('/auth/me', autenticacionTramitador, AuthTramitadorController.me)

router.post('/auth/cambiar-contrasena',
  autenticacionTramitador,
  body('contrasenaActual').isString().notEmpty().withMessage('Ingrese su contraseña actual'),
  contrasenaSegura('contrasena', 'La nueva contraseña'),
  handleInputErrors,
  AuthTramitadorController.cambiarContrasena
)

// ── Mis trámites ──────────────
// Todo lo demás exige sesión y contraseña definitiva (no la temporal)
const sesion = [autenticacionTramitador, exigirContrasenaDefinitiva]
const idTramite = param('id').isInt({ min: 1 }).withMessage('Trámite no válido')
const textoObligatorio = (campo: string, nombre: string) =>
  body(campo).isString().trim()
    .notEmpty().withMessage(`Escriba ${nombre}`)
    .isLength({ max: 1000 }).withMessage(`${nombre[0].toUpperCase()}${nombre.slice(1)} no puede superar 1000 caracteres`)

router.get('/tramites',
  ...sesion,
  query('filtro').optional().isIn(['activos', 'cerrados', 'todos', 'sinFactura']).withMessage('Filtro no válido'),
  query('busqueda').optional().isString().isLength({ max: 100 }),
  query('pagina').optional().isInt({ min: 1 }),
  handleInputErrors,
  TramitesTramitadorController.listar
)
router.get('/tramites/:id', ...sesion, idTramite, handleInputErrors, TramitesTramitadorController.detalle)
router.post('/tramites/:id/comentarios',
  ...sesion, idTramite, textoObligatorio('comentario', 'el comentario'), handleInputErrors,
  TramitesTramitadorController.comentar
)
// Documentos soporte del trámite (se ven también en Nodex Trámites → Documentos)
router.post('/tramites/:id/documentos',
  ...sesion, recibirDocumentos, idTramite,
  body('tipoDocumento').isIn(Object.keys(TIPOS_DOCUMENTO_TRAMITE)).withMessage('Seleccione el tipo de documento'),
  body('solicitudGastoId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Gasto no válido'),
  handleInputErrors,
  TramitesTramitadorController.subirDocumentos
)
router.get('/tramites/:id/documentos/:documentoId/ver',
  ...sesion, idTramite, param('documentoId').isInt({ min: 1 }), handleInputErrors,
  TramitesTramitadorController.verDocumento
)
router.post('/tramites/:id/realizado',
  ...sesion, idTramite, textoObligatorio('observacion', 'la observación'), handleInputErrors,
  TramitesTramitadorController.reportarRealizado
)

// ── Mis gastos y soportes ──────────────
const idGasto = param('id').isInt({ min: 1 }).withMessage('Gasto no válido')

router.get('/gastos',
  ...sesion,
  query('pagina').optional().isInt({ min: 1 }),
  handleInputErrors,
  GastosTramitadorController.listar
)
router.get('/gastos/:id', ...sesion, idGasto, handleInputErrors, GastosTramitadorController.detalle)
router.post('/gastos/:id/soportes',
  ...sesion,
  recibirDocumentos,
  idGasto,
  body('tipo').isIn(['FACTURA', 'REINTEGRO', 'OTRO']).withMessage('Seleccione el tipo de documento: Factura, Reintegro u Otro'),
  body('reintegroId')
    .if(body('tipo').equals('REINTEGRO'))
    .isInt({ min: 1 }).withMessage('Indique el reintegro'),
  body('observacion').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }).withMessage('La observación no puede superar 1000 caracteres'),
  handleInputErrors,
  GastosTramitadorController.subirSoporte
)
router.get('/soportes/archivos/:id/ver',
  ...sesion,
  param('id').isInt({ min: 1 }),
  handleInputErrors,
  GastosTramitadorController.verArchivo
)

// ── Notificaciones push del celular ──────────────
const endpointPush = body('endpoint').isURL({ protocols: ['https'], require_tld: true }).withMessage('Suscripción no válida').isLength({ max: 1000 })

router.get('/notificaciones/clave', ...sesion, NotificacionesTramitadorController.clave)
router.post('/notificaciones/suscripcion',
  ...sesion,
  endpointPush,
  body(['keys.p256dh', 'keys.auth']).isString().notEmpty().isLength({ max: 200 }).withMessage('Suscripción no válida'),
  handleInputErrors,
  NotificacionesTramitadorController.suscribir
)
router.delete('/notificaciones/suscripcion', ...sesion, endpointPush, handleInputErrors, NotificacionesTramitadorController.desuscribir)
router.post('/notificaciones/prueba', ...sesion, NotificacionesTramitadorController.prueba)

// ── Mi ruta (solo mensajeros) ──────────────
router.get('/ruta',
  ...sesion,
  query('fecha').optional().isISO8601({ strict: true }).withMessage('Fecha no válida'),
  handleInputErrors,
  RutaMensajeroController.ruta
)
router.post('/ruta/paradas/:id/confirmar',
  ...sesion,
  recibirFoto,
  param('id').isInt({ min: 1 }).withMessage('Parada no válida'),
  body('estado').isIn(['ENTREGADO', 'NO_SE_PUDO']).withMessage('Indique si se entregó o no se pudo'),
  body('observacion').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }).withMessage('La observación no puede superar 1000 caracteres'),
  body(['latitud', 'longitud', 'precision']).optional({ values: 'falsy' }).isFloat().withMessage('Ubicación no válida'),
  handleInputErrors,
  RutaMensajeroController.confirmar
)
// Ubicación en vivo mientras el mensajero tiene la ruta iniciada (cada ~1 min, con la app abierta)
router.post('/ruta/ubicacion',
  ...sesion,
  body(['latitud', 'longitud']).isFloat().withMessage('Ubicación no válida'),
  body('precision').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Ubicación no válida'),
  handleInputErrors,
  RutaMensajeroController.ubicacion
)
// Rutas del día (PESV): inicio y fin de la ruta, almuerzo e inicio de cada diligencia
const gpsOpcional = body(['latitud', 'longitud']).optional({ values: 'null' }).isFloat().withMessage('Ubicación no válida')
router.post('/ruta/jornada/iniciar', ...sesion, gpsOpcional, handleInputErrors, RutaMensajeroController.iniciarJornada)
router.post('/ruta/jornada/finalizar', ...sesion, gpsOpcional, handleInputErrors, RutaMensajeroController.finalizarJornada)
router.post('/ruta/jornada/almuerzo/iniciar', ...sesion, RutaMensajeroController.almuerzo('iniciar'))
router.post('/ruta/jornada/almuerzo/terminar', ...sesion, RutaMensajeroController.almuerzo('terminar'))
router.post('/ruta/paradas/:id/iniciar',
  ...sesion,
  param('id').isInt({ min: 1 }).withMessage('Parada no válida'),
  gpsOpcional,
  handleInputErrors,
  RutaMensajeroController.iniciarDiligencia
)
router.get('/ruta/paradas/:id/foto',
  ...sesion,
  param('id').isInt({ min: 1 }),
  handleInputErrors,
  RutaMensajeroController.foto
)

export default router
