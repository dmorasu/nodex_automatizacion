import { Router } from "express"
import { SubEstadosController } from "../controllers/SubEstadosController"

const router = Router()

router.get(
  '/:tramiteId',
  SubEstadosController.getByTramite
)

export default router