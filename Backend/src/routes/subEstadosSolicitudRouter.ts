import { Router } from "express"
import { SubEstadosSolicitudController }
from "../controllers/SubEstadosSolicitudController"

const router = Router({ mergeParams:true })

router.post(
  '/',
  SubEstadosSolicitudController.create
)

export default router