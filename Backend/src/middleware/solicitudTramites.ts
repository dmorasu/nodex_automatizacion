import type { Request, Response, NextFunction } from "express";
import { param, validationResult, body } from "express-validator";
import SolicitudTramites from "../models/solicitudTramites";
import DocumentoSolicitud from "../models/documentosSolicitud";
import { creadoresPermitidos, soloTramitesPropios } from "./auth";

export const validateSolicitudTramiteExits = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { solicitudTramitesId } = req.params;

    // 1️⃣ Normalizar string | string[]
    const id = Array.isArray(solicitudTramitesId)
      ? solicitudTramitesId[0]
      : solicitudTramitesId;

    // 2️⃣ Convertir a number
    const idNumber = Number(id);

    // 3️⃣ Validar ID
    if (isNaN(idNumber)) {
      return res
        .status(400)
        .json({ error: "ID de solicitud de trámite inválido" });
    }

    // 4️⃣ Buscar en DB
    const solicitudTramites = await SolicitudTramites.findByPk(idNumber);

    // Gestión de activos solo accede a los trámites que creó él o alguien de su área
    // (a los demás, como si no existieran)
    const permitidos = solicitudTramites && await creadoresPermitidos(req)
    if (!solicitudTramites || (permitidos && !permitidos.includes(solicitudTramites.usuarioId))) {
      return res.status(404).json({
        error: "La solicitud buscada no se encuentra en la base de datos",
      });
    }

    // 5️⃣ Adjuntar al request
    req.solicitudTramites = solicitudTramites;
    next();

  } catch (error) {
    res.status(500).json({ error: "Hubo un error" });
  }
};

export const validateSolicitudTramitesInput = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await body("direccionTramite")
    .notEmpty()
    .withMessage("La dirección de diligencia no puede estar vacía")
    .run(req);

  await body("detalleSolicitud")
    .notEmpty()
    .withMessage("Debe ingresar un detalle a la solicitud")
    .isLength({ max: 200 })
    .withMessage("El detalle de la solicitud no puede superar los 200 caracteres")
    .run(req);
  await body("fechaEntregaResultado")
    .notEmpty()
    .withMessage("Debe ingresar la fecha de entrega de resultado")
    .run(req);

  next();
};

export const validateSolicitudTramitesId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await param("solicitudTramitesId")
    .isInt({ gt: 0 })
    .withMessage("ID no válido")
    .run(req);

  const error = validationResult(req);
  if (!error.isEmpty()) {
    return res.status(400).json({ error: error.array() });
  }

  next();
};


// =====================================================
// ACCESO DE GESTIÓN DE ACTIVOS A RECURSOS DEL TRÁMITE
// Gestión de activos solo accede a lo de los trámites que creó él o alguien de su área.
// Se responde 404 (como si no existiera) para no revelar trámites ajenos.
// =====================================================

export const puedeAccederTramite = async (req: Request, tramiteId: unknown) => {
  const permitidos = await creadoresPermitidos(req)
  if (!permitidos) return true

  const tramite = await SolicitudTramites.findByPk(Number(tramiteId), { attributes: ["id", "usuarioId"] })
  return !!tramite && permitidos.includes(tramite.usuarioId)
}

const responderNoEncontrado = (res: Response) =>
  res.status(404).json({ error: "La solicitud buscada no se encuentra en la base de datos" })

// Trámite indicado en la URL (ej: /documentos/solicitud/:solicitudTramiteId)
export const verificarTramiteEnParametro = (nombre: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await puedeAccederTramite(req, req.params[nombre]))) return responderNoEncontrado(res)
      next()
    } catch {
      res.status(500).json({ error: "Hubo un error" })
    }
  }

// Trámite indicado en el cuerpo (ej: subir documentos; va después de multer)
export const verificarTramiteEnCuerpo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body?.solicitudTramiteId && !(await puedeAccederTramite(req, req.body.solicitudTramiteId))) {
      return responderNoEncontrado(res)
    }
    next()
  } catch {
    res.status(500).json({ error: "Hubo un error" })
  }
}

// Documento por id (ver, descargar, eliminar): se verifica el trámite al que pertenece
export const verificarTramiteDeDocumento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (soloTramitesPropios(req)) {
      const documento = await DocumentoSolicitud.findByPk(Number(req.params.id), { attributes: ["id", "solicitudTramiteId"] })
      if (!documento || !(await puedeAccederTramite(req, documento.solicitudTramiteId))) return responderNoEncontrado(res)
    }
    next()
  } catch {
    res.status(500).json({ error: "Hubo un error" })
  }
}
