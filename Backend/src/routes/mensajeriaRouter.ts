import { Router } from 'express'
import { MensajeriaController } from '../controllers/mensajeria/MensajeriaController'

// Rutas de mensajeros (/api/mensajeria). La sesión y el perfil Torre de control se exigen en server.ts
const router = Router()

router.get('/configuracion', MensajeriaController.configuracion)

router.get('/sedes', MensajeriaController.sedes)
router.post('/sedes', MensajeriaController.guardarSede)
router.put('/sedes/:id', MensajeriaController.guardarSede)

router.get('/rutas', MensajeriaController.rutas)
router.get('/ubicaciones', MensajeriaController.ubicaciones)
router.get('/reporte/exportar', MensajeriaController.exportarReporte)
router.put('/rutas/:tramitadorId/orden', MensajeriaController.reordenar)
router.post('/rutas/:tramitadorId/optimizar', MensajeriaController.optimizar)
// Agregar trámites a la ruta de un mensajero: vista previa y confirmar
router.post('/rutas/:tramitadorId/agregar/revisar', MensajeriaController.revisarParaRuta)
router.post('/rutas/:tramitadorId/agregar', MensajeriaController.agregarARuta)
router.post('/ubicar-pendientes', MensajeriaController.ubicarPendientes)
router.post('/trazado', MensajeriaController.trazado)

router.post('/tramites/:id/ubicar', MensajeriaController.ubicar)
router.put('/tramites/:id/ubicacion', MensajeriaController.ubicarManual)

router.get('/paradas/:id/foto', MensajeriaController.foto)

export default router
