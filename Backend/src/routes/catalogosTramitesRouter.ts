import { Router, type NextFunction, type Request, type Response } from 'express'
import { puedeAsignarAnalistas } from '../middleware/auth'
import { borrarCatalogo, ErrorCatalogo, guardarCatalogo, listarAreas, listarCatalogos, type TipoCatalogo } from '../services/catalogosTramites'
import { generarExcelCatalogos } from '../services/exportarCatalogos'

// Catálogos de Nodex Trámites (/api/catalogos-tramites): tipos de trámite, subestados,
// operaciones, tipos de rechazo y áreas. Los administra el Administrador de Torre de control o Admin.
const router = Router()

const TIPOS: TipoCatalogo[] = ['tramites', 'operaciones', 'subestados', 'rechazos', 'areas']

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorCatalogo) return res.status(error.status).json({ error: error.message })
  console.error('CATÁLOGOS DE TRÁMITES:', error)
  return res.status(500).json({ error: 'No se pudo completar la operación' })
}

// Excel de los catálogos: va antes del permiso de administrador porque Torre de control también
// descarga (solo la hoja de Tramitadores, la única pestaña que ve en pantalla)
router.get('/exportar', async (req: Request, res: Response) => {
  try {
    const archivo = await generarExcelCatalogos(puedeAsignarAnalistas(req))
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="catalogos-tramites-${hoy}.xlsx"`)
    res.send(archivo)
  } catch (error) {
    responder(res, error)
  }
})

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

// Solo las áreas (para elegir el área en el formulario de usuarios)
router.get('/areas', async (_req: Request, res: Response) => {
  try {
    res.json(await listarAreas())
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
