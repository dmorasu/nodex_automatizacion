import type { Request, Response, NextFunction } from "express";
import { param, validationResult, body } from "express-validator";
import SolicitudTramites from "../models/solicitudTramites";

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

    if (!solicitudTramites) {
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
