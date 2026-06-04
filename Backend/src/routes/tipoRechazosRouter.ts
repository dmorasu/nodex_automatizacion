import { Router } from "express";
import { TiposRechazoController } from "../controllers/TiposRechazosController";

const router = Router();

router.get("/", TiposRechazoController.getAll);

export default router;