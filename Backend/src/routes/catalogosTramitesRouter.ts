import { Router, type NextFunction, type Request, type Response } from 'express'
import { puedeAsignarAnalistas } from '../middleware/auth'
import { borrarCatalogo, ErrorCatalogo, guardarCatalogo, listarCatalogos, type TipoCatalogo } from '../services/catalogosTramites'

// Catálogos de Nodex Trámites (/api/catalogos-tramites): tipos de trámite, subestados,
// operaciones y tipos de rechazo. Los administra el Administrador de Torre de control o Admin.
const router = Router()

const TIPOS: TipoCatalogo[] = ['tramites', 'operaciones', 'subestados', 'rechazos']

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorCatalogo) return res.status(error.status).json({ error: error.message })
  console.error('CATÁLOGOS DE TRÁMITES:', error)
  return res.status(500).json({ error: 'No se pudo completar la operación' })
}

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!puedeAsignarAnalistas(req)) return res.status(403).json({ error: 'No tiene permiso para administrar los catálogos' })
  next()
})

router.param('tipo', (req: Request, res: Response, next: NextFunction, tipo: string) => {
  if (!TIPOS.includes(tipo as TipoCatalogo)) return res.status(404).json({ error: 'Catálogo no válido' })
  next()
})

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await listarCatalogos())
  } catch (error) {
    responder(res, error)
  }
})

router.post('/:tipo', async (req: Request, res: Response) => {
  try {
    res.status(201).json(await guardarCatalogo(req.params.tipo as TipoCatalogo, req.body ?? {}))
  } catch (error) {
    responder(res, error)
  }
})

router.put('/:tipo/:id', async (req: Request, res: Response) => {
  try {
    res.json(await guardarCatalogo(req.params.tipo as TipoCatalogo, req.body ?? {}, Number(req.params.id)))
  } catch (error) {
    responder(res, error)
  }
})

router.delete('/:tipo/:id', async (req: Request, res: Response) => {
  try {
    await borrarCatalogo(req.params.tipo as TipoCatalogo, Number(req.params.id))
    res.json({ ok: true })
  } catch (error) {
    responder(res, error)
  }
})

export default router
