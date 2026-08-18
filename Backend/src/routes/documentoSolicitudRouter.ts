import { Router } from "express";

import {
  DocumentoSolicitudController
} from "../controllers/documentoSolicitudController";

import uploadDocumento from "../middleware/uploadDocumento";

import {
  autenticacion
} from "../middleware/auth";


const router = Router();


router.post(
  "/",
  autenticacion,
  uploadDocumento.array("documentos", 10),
  DocumentoSolicitudController.subirDocumentos
);


router.get(
  "/solicitud/:solicitudTramiteId",
  autenticacion,
  DocumentoSolicitudController.listarDocumentos
);


router.get(
  "/:id/ver",
  autenticacion,
  DocumentoSolicitudController.verDocumento
);

router.get(
  "/:id/descargar",
  autenticacion,
  DocumentoSolicitudController.descargarDocumento
);
router.delete(
  "/:id",
  autenticacion,
  DocumentoSolicitudController.eliminarDocumento
);


export default router;