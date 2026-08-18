import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (
  req,
  file,
  cb
) => {

  // ==========================================
  // VALIDAR TIPO
  // ==========================================

  if (file.mimetype !== "application/pdf") {
    return cb(
      new Error("Solo se permiten archivos PDF.")
    );
  }


  // ==========================================
  // VALIDAR NOMBRE
  // ==========================================

  const nombreOriginal = file.originalname;

  const puntoExtension =
    nombreOriginal.lastIndexOf(".");

  const nombreSinExtension =
    puntoExtension !== -1
      ? nombreOriginal.substring(0, puntoExtension)
      : nombreOriginal;


  if (nombreSinExtension.length > 20) {
    return cb(
      new Error(
        "El nombre del archivo no puede tener más de 20 caracteres."
      )
    );
  }


  cb(null, true);
};


const uploadDocumento = multer({

  storage,

  limits: {

    // Máximo 10 MB por archivo
    fileSize: 32 * 1024 * 1024,

    // Máximo 10 archivos
    files: 10,

  },

  fileFilter,

});


export default uploadDocumento;