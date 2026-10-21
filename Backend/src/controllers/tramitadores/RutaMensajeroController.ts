import type { Request, Response } from 'express'
import multer from 'multer'
import type { NextFunction } from 'express'
import ParadaMensajeria from '../../models/mensajeria/paradaMensajeria'
import { obtenerArchivo } from '../../services/azureFileStorage'
import { ErrorUbicacion } from '../../services/mensajeria/ubicacion'
import { confirmarParada, hoyBogota, rutaDelMensajero } from '../../services/mensajeria/rutas'
import { registrarUbicacion } from '../../services/mensajeria/ubicacionEnVivo'
import { finalizarJornada, iniciarAlmuerzo, iniciarDiligencia, iniciarJornada, terminarAlmuerzo } from '../../services/mensajeria/jornadas'

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorUbicacion) return res.status(error.status).json({ error: error.message })
  console.error('RUTA MENSAJERO:', error)
  return res.status(500).json({ error: 'No se pudo completar la operación' })
}

// Una foto (JPG o PNG, máximo 15 MB) en el campo "foto"
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } })
export const recibirFoto = (req: Request, res: Response, next: NextFunction) =>
  subida.single('foto')(req, res, error => {
    if (!error) return next()
    const mensaje = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'La foto puede pesar máximo 15 MB' : 'No se pudo recibir la foto'
    res.status(400).json({ error: mensaje })
  })

// App Nodex Tramitadores: ruta del día del mensajero en sesión
export class RutaMensajeroController {

  // GET /ruta?fecha=YYYY-MM-DD (por defecto hoy)
  static ruta = async (req: Request, res: Response) => {
    try {
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha ?? '')) ? String(req.query.fecha) : hoyBogota()
      res.json(await rutaDelMensajero(req.sesionTramitador!.tramitadorId, fecha))
    } catch (error) {
      responder(res, error)
    }
  }

  // POST /ruta/paradas/:id/confirmar (multipart: estado, observacion, latitud, longitud, precision, foto)
  static confirmar = async (req: Request, res: Response) => {
    try {
      await confirmarParada(req.sesionTramitador!.tramitadorId, Number(req.params.id), req.body, req.file)
      res.json({ mensaje: 'Visita confirmada' })
    } catch (error) {
      responder(res, error)
    }
  }

  // POST /ruta/ubicacion { latitud, longitud, precision }: posición mientras la ruta está iniciada
  static ubicacion = async (req: Request, res: Response) => {
    try {
      res.json(await registrarUbicacion(req.sesionTramitador!.tramitadorId, req.body))
    } catch (error) {
      responder(res, error)
    }
  }

  // POST /ruta/jornada/iniciar | finalizar { latitud?, longitud? }
  static iniciarJornada = async (req: Request, res: Response) => {
    try {
      await iniciarJornada(req.sesionTramitador!.tramitadorId, req.body)
      res.json({ mensaje: 'Ruta iniciada' })
    } catch (error) {
      responder(res, error)
    }
  }

  static finalizarJornada = async (req: Request, res: Response) => {
    try {
      const jornada = await finalizarJornada(req.sesionTramitador!.tramitadorId, req.body)
      res.json({ mensaje: 'Ruta finalizada', km: Number(jornada.kmGps ?? 0) })
    } catch (error) {
      responder(res, error)
    }
  }

  // POST /ruta/jornada/almuerzo/iniciar | terminar
  static almuerzo = (accion: 'iniciar' | 'terminar') => async (req: Request, res: Response) => {
    try {
      const tramitadorId = req.sesionTramitador!.tramitadorId
      await (accion === 'iniciar' ? iniciarAlmuerzo(tramitadorId) : terminarAlmuerzo(tramitadorId))
      res.json({ mensaje: accion === 'iniciar' ? 'Almuerzo iniciado' : 'Almuerzo terminado' })
    } catch (error) {
      responder(res, error)
    }
  }

  // POST /ruta/paradas/:id/iniciar { latitud?, longitud? }: llegó al sitio de la diligencia
  static iniciarDiligencia = async (req: Request, res: Response) => {
    try {
      await iniciarDiligencia(req.sesionTramitador!.tramitadorId, Number(req.params.id), req.body)
      res.json({ mensaje: 'Diligencia iniciada' })
    } catch (error) {
      responder(res, error)
    }
  }

  // GET /ruta/paradas/:id/foto
  static foto = async (req: Request, res: Response) => {
    try {
      const parada = await ParadaMensajeria.findByPk(Number(req.params.id))
      if (!parada || parada.tramitadorId !== req.sesionTramitador!.tramitadorId || !parada.fotoRuta || !parada.fotoNombre) {
        throw new ErrorUbicacion('La visita no tiene foto', 404)
      }
      res.setHeader('Content-Type', parada.fotoTipo ?? 'image/jpeg')
      res.send(await obtenerArchivo(parada.fotoRuta, parada.fotoNombre))
    } catch (error) {
      responder(res, error)
    }
  }
}
