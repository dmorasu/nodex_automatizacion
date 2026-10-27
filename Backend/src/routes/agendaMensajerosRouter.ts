import { Router, type Request, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { handleInputErrors } from '../middleware/validation'
import { responderError } from '../controllers/gastos/utilidades'
import { agendaDelDia, asignarDesdeAgenda, cancelarReserva, crearReserva, tramitesSinMensajero } from '../services/mensajeria/agenda'
import { hoyBogota } from '../services/mensajeria/rutas'
import { TIPOS_RESERVA } from '../models/mensajeria/reservaAgenda'
import { ErrorGastos } from '../services/gastos/errores'

// Agenda de los mensajeros (/api/agenda-mensajeros): la ven Gestión de activos y Torre de control
// (la sesión y el perfil se exigen en server.ts). Gestión de activos solo aparta espacios: no
// cambia nada de los trámites ni del mensajero. "No disponible", la bandeja de trámites sin
// mensajero y asignar desde la agenda son solo de Torre de control.
const router = Router()

const usuarioDe = (req: Request) => ({ id: Number(req.usuario.id), esTorreControl: (req.roles ?? []).some(r => r === 'TORRE_CONTROL' || r === 'ADMIN') })
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const hora = (campo: string) => body(campo).matches(HORA).withMessage('La hora no es válida')
// Con día completo las horas no se envían (el .if va antes de lo que condiciona)
const horaSalvoDiaCompleto = (campo: string) =>
  body(campo).if((_valor, { req }) => req.body.diaCompleto !== true).matches(HORA).withMessage('La hora no es válida')

const exigirTorreControl = (req: Request) => {
  if (!usuarioDe(req).esTorreControl) throw new ErrorGastos('Solo Torre de control puede hacer esto', 403)
}

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
  body('tipo').optional().isIn(Object.values(TIPOS_RESERVA)).withMessage('Tipo no válido'),
  body('diaCompleto').optional().isBoolean().withMessage('Día completo no válido'),
  horaSalvoDiaCompleto('horaInicio'),
  horaSalvoDiaCompleto('horaFin'),
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
        tipo: req.body.tipo,
        diaCompleto: req.body.diaCompleto === true,
        solicitudTramiteId: req.body.solicitudTramiteId ? Number(req.body.solicitudTramiteId) : null
      }, usuarioDe(req)))
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
      const tipo = await cancelarReserva(Number(req.params.id), usuarioDe(req))
      res.json({ mensaje: tipo === TIPOS_RESERVA.NO_DISPONIBLE ? 'Se quitó "No disponible"' : 'Reserva cancelada' })
    } catch (error) {
      responderError(res, error)
    }
  }
)

router.get('/sin-mensajero',
  query('q').optional().isString().isLength({ max: 100 }),
  handleInputErrors,
  async (req: Request, res: Response) => {
    try {
      exigirTorreControl(req)
      res.json(await tramitesSinMensajero(String(req.query.q ?? '')))
    } catch (error) {
      responderError(res, error)
    }
  }
)

router.post('/asignar',
  body('tramiteId').isInt({ min: 1 }).withMessage('Elija el trámite'),
  body('tramitadorId').isInt({ min: 1 }).withMessage('Elija el mensajero'),
  body('fecha').isISO8601({ strict: true }).withMessage('La fecha no es válida'),
  hora('horaInicio'),
  hora('horaFin'),
  handleInputErrors,
  async (req: Request, res: Response) => {
    try {
      exigirTorreControl(req)
      await asignarDesdeAgenda({
        tramiteId: Number(req.body.tramiteId),
        tramitadorId: Number(req.body.tramitadorId),
        fecha: String(req.body.fecha).slice(0, 10),
        horaInicio: req.body.horaInicio,
        horaFin: req.body.horaFin
      })
      res.json({ mensaje: 'Trámite asignado y cita programada' })
    } catch (error) {
      responderError(res, error)
    }
  }
)

export default router
