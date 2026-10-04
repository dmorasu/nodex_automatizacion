import { Router } from 'express'
import { NotificacionesController } from '../controllers/NotificacionesController'
import { verificarTramiteEnParametro } from '../middleware/solicitudTramites'

const router = Router()

router.get(
  '/solicitud/:solicitudTramiteId',
  verificarTramiteEnParametro('solicitudTramiteId'),
  NotificacionesController.obtenerPorSolicitud
)

export default router