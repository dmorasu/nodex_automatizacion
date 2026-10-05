import { Router, type Request, type Response, type NextFunction } from 'express'
import { NotificacionesProgramadasController } from '../controllers/NotificacionesProgramadasController'
import { puedeConfigurarNotificaciones } from '../middleware/auth'

// Notificaciones automáticas de WhatsApp (/api/notificaciones-programadas).
// La sesión se exige en server.ts.
const router = Router()

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!puedeConfigurarNotificaciones(req)) {
    return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' })
  }
  next()
})

router.get('/', NotificacionesProgramadasController.listar)
router.put('/:clave', NotificacionesProgramadasController.actualizar)
router.post('/:clave/enviar-ahora', NotificacionesProgramadasController.enviarAhora)

export default router
