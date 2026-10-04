import multer from 'multer'
import type { Request, Response, NextFunction } from 'express'

export const TIPOS_ARCHIVO_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png']
export const MAX_ARCHIVOS = 10
const MAX_TAMANO_MB = 15

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_TAMANO_MB * 1024 * 1024,
    files: MAX_ARCHIVOS
  },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ARCHIVO_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error(`"${file.originalname}" no es válido. Solo se permiten PDF, JPG o PNG`))
    }
    cb(null, true)
  }
})

// Recibe hasta 10 archivos en el campo "archivos" y convierte los errores
// de multer (tipo, tamaño, cantidad) en respuestas 400 con mensaje claro
export const recibirDocumentos = (req: Request, res: Response, next: NextFunction) => {
  upload.array('archivos', MAX_ARCHIVOS)(req, res, error => {
    if (!error) return next()

    if (error instanceof multer.MulterError) {
      const mensajes: Partial<Record<multer.ErrorCode, string>> = {
        LIMIT_FILE_SIZE: `Cada archivo puede pesar máximo ${MAX_TAMANO_MB} MB`,
        LIMIT_FILE_COUNT: `Puede subir máximo ${MAX_ARCHIVOS} archivos a la vez`,
        LIMIT_UNEXPECTED_FILE: 'Los archivos deben enviarse en el campo "archivos"'
      }
      return res.status(400).json({ error: mensajes[error.code] ?? error.message })
    }

    return res.status(400).json({ error: error.message })
  })
}
