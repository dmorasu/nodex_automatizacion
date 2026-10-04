import { Router } from "express";

import {
  DocumentoSolicitudController
} from "../controllers/documentoSolicitudController";

import uploadDocumento from "../middleware/uploadDocumento";

import {
  autenticacion
} from "../middleware/auth";

import {
  verificarTramiteDeDocumento,
  verificarTramiteEnCuerpo,
  verificarTramiteEnParametro
} from "../middleware/solicitudTramites";


const router = Router();


router.post(
  "/",
  autenticacion,
  uploadDocumento.array("documentos", 10),
  verificarTramiteEnCuerpo,
  DocumentoSolicitudController.subirDocumentos
);


router.get(
  "/solicitud/:solicitudTramiteId",
  autenticacion,
  verificarTramiteEnParametro("solicitudTramiteId"),
  DocumentoSolicitudController.listarDocumentos
);


router.get(
  "/:id/ver",
  autenticacion,
  verificarTramiteDeDocumento,
  DocumentoSolicitudController.verDocumento
);

router.get(
  "/:id/descargar",
  autenticacion,
  verificarTramiteDeDocumento,
  DocumentoSolicitudController.descargarDocumento
);
router.delete(
  "/:id",
  autenticacion,
  verificarTramiteDeDocumento,
  DocumentoSolicitudController.eliminarDocumento
);


export default router;