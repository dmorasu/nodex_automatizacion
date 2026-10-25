import type { Request, Response, NextFunction } from "express";
import { param, validationResult, body } from "express-validator";
import Tramitador from "../models/tramitador";
import { regionesDeMunicipios } from "../services/regionesMunicipios";

export const validateTramitadorExits = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tramitadorId } = req.params;

    // 1️⃣ Normalizar string | string[]
    const id = Array.isArray(tramitadorId)
      ? tramitadorId[0]
      : tramitadorId;

    // 2️⃣ Convertir a number
    const idNumber = Number(id);

    // 3️⃣ Validar ID
    if (isNaN(idNumber)) {
      return res.status(400).json({ error: "ID de tramitador inválido" });
    }

    // 4️⃣ Buscar en DB
    const tramitador = await Tramitador.findByPk(idNumber);

    if (!tramitador) {
      return res
        .status(404)
        .json({ error: "Dato no encontrado en la base de datos" });
    }

    // 5️⃣ Adjuntar al request
    req.tramitador = tramitador;
    next();

  } catch (error) {
    res.status(500).json({ error: "Hubo un error" });
  }
};

// Datos del tramitador (crear y editar). El número de WhatsApp se guarda solo con
// dígitos e indicativo de país (ej: 573001234567), igual que los ya registrados.
export const validateTramitadorInput = [
  body("nombreTramitador")
    .isString().trim()
    .notEmpty().withMessage("El nombre no puede estar vacío")
    .isLength({ max: 200 }).withMessage("El nombre no puede superar 200 caracteres"),
  body("identificacion")
    .isString().trim()
    .notEmpty().withMessage("La identificación es obligatoria")
    .isLength({ max: 50 }).withMessage("La identificación no puede superar 50 caracteres"),
  body("correoTramitador")
    .isEmail().withMessage("Correo no válido")
    .isLength({ max: 150 }),
  body("numeroTramitador")
    .customSanitizer(valor => String(valor ?? "").replace(/[\s-]/g, ""))
    .matches(/^\d{10,15}$/).withMessage("El WhatsApp debe tener solo números con el indicativo del país (ej: 573001234567)"),
  body("region")
    .isString().withMessage("Elija la región del tramitador").bail()
    .trim()
    .notEmpty().withMessage("Elija la región del tramitador").bail()
    .custom(async region => {
      // Solo las regionales de los municipios (lista desplegable del formulario)
      if (!(await regionesDeMunicipios()).includes(region)) throw new Error(`La región "${region}" no existe`)
    }),
  body("activo").optional().isBoolean().withMessage("Activo debe ser verdadero o falso").toBoolean(),
  body("esMensajero").optional().isBoolean().withMessage("Mensajero debe ser verdadero o falso").toBoolean(),
  body("sedeId").optional({ values: "null" }).isInt({ min: 1 }).withMessage("Sede no válida").toInt(),
  // Datos de la cuenta de cobro (opcionales al crear; se exigen al enviar la cuenta)
  body("direccion").optional({ values: "null" }).isString().isLength({ max: 200 }).withMessage("La dirección puede tener máximo 200 caracteres"),
  body("ciudad").optional({ values: "null" }).isString().isLength({ max: 100 }).withMessage("La ciudad puede tener máximo 100 caracteres"),
  body("banco").optional({ values: "null" }).isString().isLength({ max: 100 }).withMessage("El banco puede tener máximo 100 caracteres"),
  body("tipoCuenta").optional({ values: "falsy" }).isIn(["AHORROS", "CORRIENTE", "BILLETERA"]).withMessage("Tipo de cuenta no válido"),
  body("numeroCuenta").optional({ values: "null" }).isString().isLength({ max: 50 }).withMessage("El número de cuenta puede tener máximo 50 caracteres"),
  body("declaracionArt383").optional().isBoolean().withMessage("Declaración debe ser verdadero o falso").toBoolean()
]

export const validateTramitadorId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await param("tramitadorId")
    .isInt({ gt: 0 })
    .withMessage("ID no válido")
    .run(req);

  const error = validationResult(req);
  if (!error.isEmpty()) {
    return res.status(400).json({ error: error.array() });
  }

  next();
};
