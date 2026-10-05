import { Router, type NextFunction, type Request, type Response } from 'express'
import { createHash, timingSafeEqual } from 'crypto'
import { listarTramitesMensajeros, TAMANO_MAXIMO } from '../services/apiExterna/tramitesMensajeros'

// =====================================
// API PARA OTRAS PLATAFORMAS (/api/externa)
// No usa la sesión de Nodex: cada petición trae el encabezado `X-API-Key` con el valor de
// API_KEY_EXTERNA (.env). Solo lectura.
// =====================================

const router = Router()

// Compara la clave sin filtrar información por el tiempo de respuesta
const mismaClave = (recibida: string, esperada: string) => {
  const hash = (valor: string) => createHash('sha256').update(valor).digest()
  return timingSafeEqual(hash(recibida), hash(esperada))
}

router.use((req: Request, res: Response, next: NextFunction) => {
  const esperada = process.env.API_KEY_EXTERNA
  if (!esperada) return res.status(503).json({ error: 'La API externa no está configurada' })

  const recibida = req.get('X-API-Key')
  if (!recibida || !mismaClave(recibida, esperada)) {
    return res.status(401).json({ error: 'API key no válida' })
  }
  next()
})

const esFecha = (valor: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor)) && !isNaN(Date.parse(String(valor)))
const entero = (valor: unknown) => (valor === undefined || valor === '' ? undefined : Number(valor))

// GET /api/externa/mensajeros/tramites
//   ?tramitadorId= &estadoId= &desde=YYYY-MM-DD &hasta=YYYY-MM-DD (día de la diligencia)
//   &pagina=1 &tamano=100 (máx. 500)
router.get('/mensajeros/tramites', async (req: Request, res: Response) => {
  const { tramitadorId, estadoId, desde, hasta, pagina, tamano } = req.query
  const errores: string[] = []

  const filtros = {
    tramitadorId: entero(tramitadorId),
    estadoId: entero(estadoId),
    desde: desde ? String(desde) : undefined,
    hasta: hasta ? String(hasta) : undefined,
    pagina: entero(pagina) ?? 1,
    tamano: entero(tamano) ?? 100
  }

  if (filtros.tramitadorId !== undefined && !(Number.isInteger(filtros.tramitadorId) && filtros.tramitadorId > 0)) errores.push('tramitadorId debe ser un número entero')
  if (filtros.estadoId !== undefined && !(Number.isInteger(filtros.estadoId) && filtros.estadoId > 0)) errores.push('estadoId debe ser un número entero')
  if (filtros.desde && !esFecha(filtros.desde)) errores.push('desde debe tener el formato YYYY-MM-DD')
  if (filtros.hasta && !esFecha(filtros.hasta)) errores.push('hasta debe tener el formato YYYY-MM-DD')
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) errores.push('desde no puede ser mayor que hasta')
  if (!Number.isInteger(filtros.pagina) || filtros.pagina < 1) errores.push('pagina debe ser un entero mayor que 0')
  if (!Number.isInteger(filtros.tamano) || filtros.tamano < 1 || filtros.tamano > TAMANO_MAXIMO) errores.push(`tamano debe estar entre 1 y ${TAMANO_MAXIMO}`)
  if (errores.length) return res.status(400).json({ errores })

  try {
    res.json(await listarTramitesMensajeros(filtros))
  } catch (error) {
    console.error('API EXTERNA - TRÁMITES MENSAJEROS:', error)
    res.status(500).json({ error: 'No se pudieron consultar los trámites' })
  }
})

export default router
