import { Router, type Request, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { handleInputErrors } from '../middleware/validation'
import { responderError } from '../controllers/gastos/utilidades'
import { agendaDelDia, cancelarReserva, crearReserva } from '../services/mensajeria/agenda'
import { hoyBogota } from '../services/mensajeria/rutas'

// Agenda de los mensajeros (/api/agenda-mensajeros): la ven Gestión de activos y Torre de control
// (la sesión y el perfil se exigen en server.ts). Gestión de activos solo aparta espacios: no
// cambia nada de los trámites ni del mensajero.
const router = Router()

const usuarioDe = (req: Request) => ({ id: Number(req.usuario.id), esTorreControl: (req.roles ?? []).some(r => r === 'TORRE_CONTROL' || r === 'ADMIN') })
const hora = (campo: string) => body(campo).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('La hora no es válida')

router.get('/',
  query('fecha').optional().isISO8601({ strict: true }).withMessage('La fecha no es válida'),
  query('sedeId').optional().isInt({ min: 1 }).withMessage('Sede no válida'),
  handleInputErrors,
  async (req: Request, res: Response) => {
    try {
      const fecha = req.query.fecha ? String(req.query.fecha).slice(0, 10) : hoyBogota()
      res.json(await agendaDelDia(fecha, req.query.sedeId ? Number(req.query.sedeId) : undefined, usuarioDe(req)))
    } catch (error) {
      responderError(res, error)
    }
  }
)

router.post('/reservas',
  body('tramitadorId').isInt({ min: 1 }).withMessage('Elija el mensajero'),
  body('fecha').isISO8601({ strict: true }).withMessage('La fecha no es válida'),
  hora('horaInicio'),
  hora('horaFin'),
  body('motivo').isString().trim().notEmpty().withMessage('Indique el motivo de la reserva').isLength({ max: 300 }).withMessage('El motivo puede tener máximo 300 caracteres'),
  body('solicitudTramiteId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('El número del trámite no es válido'),
  handleInputErrors,
  async (req: Request, res: Response) => {
    try {
      res.status(201).json(await crearReserva({
        tramitadorId: Number(req.body.tramitadorId),
        fecha: String(req.body.fecha).slice(0, 10),
        horaInicio: req.body.horaInicio,
        horaFin: req.body.horaFin,
        motivo: req.body.motivo,
        solicitudTramiteId: req.body.solicitudTramiteId ? Number(req.body.solicitudTramiteId) : null
      }, Number(req.usuario.id)))
    } catch (error) {
      responderError(res, error)
    }
  }
)

router.post('/reservas/:id/cancelar',
  param('id').isInt({ min: 1 }).withMessage('Reserva no válida'),
  handleInputErrors,
  async (req: Request, res: Response) => {
    try {
      await cancelarReserva(Number(req.params.id), usuarioDe(req))
      res.json({ mensaje: 'Reserva cancelada' })
    } catch (error) {
      responderError(res, error)
    }
  }
)

export default router
