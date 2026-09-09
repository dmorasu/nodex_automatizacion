import { Router } from 'express'
import { NotificacionesController } from '../controllers/NotificacionesController'

const router = Router()

router.get(
  '/solicitud/:solicitudTramiteId',
  NotificacionesController.obtenerPorSolicitud
)

export default router