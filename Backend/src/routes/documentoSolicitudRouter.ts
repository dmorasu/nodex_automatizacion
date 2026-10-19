import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import SolicitudTramites from "../models/solicitudTramites";
import { subirDocumentoATramite, tramitesParaDocumentos } from "../services/cargueMasivoDocumentos";
import { TIPOS_DOCUMENTO_TRAMITE, type TipoDocumentoTramite } from "../services/tramitadores/nombresDocumento";
import { responderError } from "../controllers/gastos/utilidades";

import {
  DocumentoSolicitudController
} from "../controllers/documentoSolicitudController";

import uploadDocumento from "../middleware/uploadDocumento";

import {
  autenticacion,
  creadoresPermitidos
} from "../middleware/auth";

import {
  verificarTramiteDeDocumento,
  verificarTramiteEnCuerpo,
  verificarTramiteEnParametro
} from "../middleware/solicitudTramites";


const router = Router();


// ── Cargue masivo de documentos (un archivo por petición; la pantalla los sube en fila) ──
const uploadUno = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024, files: 1 } });

// POST /masivo/validar { ids } → a qué trámite va cada número (los que no aparecen no existen
// o no son del usuario ni de su área)
router.post("/masivo/validar", autenticacion, async (req: Request, res: Response) => {
  try {
    const ids = ((req.body?.ids ?? []) as unknown[]).map(Number)
    res.json(await tramitesParaDocumentos(ids, await creadoresPermitidos(req)))
  } catch (error) {
    responderError(res, error)
  }
});

// POST /masivo (multipart: documento, solicitudTramiteId, tipoDocumento opcional)
router.post(
  "/masivo",
  autenticacion,
  (req: Request, res: Response, next: NextFunction) => uploadUno.single("documento")(req, res, error => {
    if (!error) return next()
    const mensaje = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "El archivo supera los 32 MB" : error.message
    res.status(400).json({ error: mensaje })
  }),
  verificarTramiteEnCuerpo,
  async (req: Request, res: Response) => {
    try {
      const solicitudTramiteId = Number(req.body.solicitudTramiteId)
      if (!req.file) return res.status(400).json({ error: "Falta el archivo" })
      if (!(solicitudTramiteId > 0) || !(await SolicitudTramites.findByPk(solicitudTramiteId, { attributes: ["id"] }))) {
        return res.status(404).json({ error: `No existe el trámite ${req.body.solicitudTramiteId}` })
      }
      const tipo = req.body.tipoDocumento && req.body.tipoDocumento in TIPOS_DOCUMENTO_TRAMITE ? req.body.tipoDocumento as TipoDocumentoTramite : null
      const documento = await subirDocumentoATramite(solicitudTramiteId, req.usuario.id, tipo, req.file)
      res.status(201).json({ id: documento.id, nombre: documento.nombreOriginal })
    } catch (error) {
      responderError(res, error)
    }
  }
);


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