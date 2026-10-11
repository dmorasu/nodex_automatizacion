import multer from 'multer'
import type { Request, Response, NextFunction } from 'express'
import { ErrorGastos } from '../../services/gastos/errores'

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

// ── Facturas de las solicitudes de factura: PDF y XML (DIAN) de cada una ──

// Los navegadores mandan el XML como text/xml, application/xml o sin tipo: se mira la extensión
const esPdf = (file: Express.Multer.File) => file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname)
const esXml = (file: Express.Multer.File) => /\.xml$/i.test(file.originalname)

const MAX_FACTURAS = 50

const uploadFacturas = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TAMANO_MB * 1024 * 1024, files: MAX_FACTURAS * 2 },
  fileFilter: (req, file, cb) => {
    const campo = /^(pdf|xml)_\d+$/.exec(file.fieldname)?.[1]
    if (campo === 'pdf' && !esPdf(file)) return cb(new Error(`"${file.originalname}" no es un PDF`))
    if (campo === 'xml' && !esXml(file)) return cb(new Error(`"${file.originalname}" no es un archivo XML`))
    if (!campo) return cb(new Error('Los archivos de la factura deben enviarse en los campos pdf_<id> y xml_<id>'))
    cb(null, true)
  }
})

export const recibirFacturas = (req: Request, res: Response, next: NextFunction) => {
  uploadFacturas.any()(req, res, error => {
    if (!error) return next()
    if (error instanceof multer.MulterError) {
      const mensajes: Partial<Record<multer.ErrorCode, string>> = {
        LIMIT_FILE_SIZE: `Cada archivo puede pesar máximo ${MAX_TAMANO_MB} MB`,
        LIMIT_FILE_COUNT: `Puede facturar máximo ${MAX_FACTURAS} solicitudes a la vez`
      }
      return res.status(400).json({ error: mensajes[error.code] ?? error.message })
    }
    return res.status(400).json({ error: error.message })
  })
}

// { id → { pdf, xml } } a partir de los campos pdf_<id> y xml_<id>
export const archivosPorSolicitud = (req: Request) => {
  const porId = new Map<number, { pdf?: Express.Multer.File, xml?: Express.Multer.File }>()
  for (const file of (req.files ?? []) as Express.Multer.File[]) {
    const [campo, id] = file.fieldname.split('_') as ['pdf' | 'xml', string]
    const actual = porId.get(Number(id)) ?? {}
    if (actual[campo]) throw new ErrorGastos(`Llegó más de un ${campo.toUpperCase()} para la misma solicitud`)
    porId.set(Number(id), { ...actual, [campo]: file })
  }
  return porId
}
