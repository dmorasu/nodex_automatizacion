import { Router, type Request, type Response } from 'express'
import { ErrorUbicacion, googleDisponible } from '../services/mensajeria/ubicacion'
import { detalleLugar, lugarDesdeEnlace, sugerirLugares } from '../services/mensajeria/lugares'

// Autocompletar la dirección del trámite (/api/direcciones). Lo usan Torre de control y
// Gestión de activos al crear o editar trámites.
const router = Router()

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorUbicacion) return res.status(error.status).json({ error: error.message })
  console.error('DIRECCIONES:', error)
  return res.status(500).json({ error: 'No se pudo consultar la dirección' })
}

// Token de sesión de Google (agrupa las búsquedas de una misma dirección para el cobro)
const sesion = (valor: unknown) => (/^[A-Za-z0-9-]{8,64}$/.test(String(valor ?? '')) ? String(valor) : undefined)

router.get('/disponible', (_req: Request, res: Response) => {
  res.json({ disponible: googleDisponible() })
})

router.get('/sugerencias', async (req: Request, res: Response) => {
  try {
    const texto = String(req.query.q ?? '').trim()
    if (texto.length < 3) return res.json([])
    res.json(await sugerirLugares(texto.slice(0, 150), sesion(req.query.sesion)))
  } catch (error) {
    responder(res, error)
  }
})

router.get('/lugares/:placeId', async (req: Request, res: Response) => {
  try {
    res.json(await detalleLugar(req.params.placeId, sesion(req.query.sesion)))
  } catch (error) {
    responder(res, error)
  }
})

router.post('/enlace', async (req: Request, res: Response) => {
  try {
    const url = String(req.body.url ?? '')
    if (!url || url.length > 2000) throw new ErrorUbicacion('Pegue un enlace de Google Maps')
    res.json(await lugarDesdeEnlace(url))
  } catch (error) {
    responder(res, error)
  }
})

export default router
