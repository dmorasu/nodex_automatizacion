import { Router, type Request, type Response } from 'express'
import { query } from 'express-validator'
import { handleInputErrors } from '../middleware/validation'
import { calificacionesPorTramitador, calificacionesPorTramite, mesesConFinalizados, type FiltrosCalificaciones } from '../services/calificaciones'

// Calificaciones de la encuesta de finalizado (/api/calificaciones). La sesión y el perfil
// Torre de control se exigen en server.ts. La encuesta se hace con POST /solicitudes/:id/evaluacion.
const router = Router()

const validarFiltros = [
  query(['desde', 'hasta']).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Fechas no válidas'),
  query('tramitadorId').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Tramitador no válido'),
  query('estado').optional().isIn(['todas', 'calificados', 'sinCalificar']).withMessage('Estado no válido'),
  query('q').optional().isString().isLength({ max: 100 }),
  query('pagina').optional().isInt({ min: 1 }).withMessage('Página no válida'),
  handleInputErrors
]

const filtros = (req: Request): FiltrosCalificaciones => ({
  desde: req.query.desde ? String(req.query.desde) : null,
  hasta: req.query.hasta ? String(req.query.hasta) : null,
  tramitadorId: req.query.tramitadorId === undefined || req.query.tramitadorId === '' ? null : Number(req.query.tramitadorId),
  estado: req.query.estado ? String(req.query.estado) : 'todas',
  q: req.query.q ? String(req.query.q) : undefined,
  pagina: req.query.pagina ? Number(req.query.pagina) : 1
})

const responder = (fn: (f: FiltrosCalificaciones) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    res.json(await fn(filtros(req)))
  } catch (error) {
    console.error('CALIFICACIONES:', error)
    res.status(500).json({ error: 'No se pudieron consultar las calificaciones' })
  }
}

router.get('/meses', responder(() => mesesConFinalizados()))
router.get('/tramites', validarFiltros, responder(calificacionesPorTramite))
router.get('/tramitadores', validarFiltros, responder(calificacionesPorTramitador))

export default router
