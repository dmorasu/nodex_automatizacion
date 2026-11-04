import { Router, type Request, type Response } from 'express'
import { responderError } from '../controllers/gastos/utilidades'
import {
  crearRotulo, leerEntrada, listarRotulos, opcionesRotulo, pdfDeRotulo, tramiteParaRotulo, vistaPreviaRotulo
} from '../services/rotulos/rotulos'

// Rótulos de envío (/api/rotulos): Torre de control, administradores y Analista de trámites
// (todos trabajan con el rol de Torre de control; lo exige server.ts)
const router = Router()

const id = (valor: unknown) => (Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : 0)

// Sedes, operaciones, transportadoras, tramitadores activos y listas del formulario
router.get('/opciones', async (_req: Request, res: Response) => {
  try { res.json(await opcionesRotulo()) } catch (error) { responderError(res, error) }
})

// Datos de un trámite para prellenar el rótulo o agregarlo al envío
router.get('/tramite/:id', async (req: Request, res: Response) => {
  try { res.json(await tramiteParaRotulo(id(req.params.id))) } catch (error) { responderError(res, error) }
})

// PDF sin guardar y lo que falta (la pantalla lo pide mientras se llena el formulario)
router.post('/vista-previa', async (req: Request, res: Response) => {
  try { res.json(await vistaPreviaRotulo(leerEntrada(req.body))) } catch (error) { responderError(res, error) }
})

// Generar: { ...rótulo, llenarLogistica }
router.post('/', async (req: Request, res: Response) => {
  try {
    res.status(201).json(await crearRotulo(leerEntrada(req.body), req.usuario.id, req.body?.llenarLogistica !== false))
  } catch (error) {
    responderError(res, error)
  }
})

// Historial: ?tramite=<id>&q=<destinatario o número de trámite>
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await listarRotulos({ tramiteId: id(req.query.tramite) || null, q: String(req.query.q ?? ''), limite: id(req.query.limite) || 50 }))
  } catch (error) {
    responderError(res, error)
  }
})

router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const pdf = await pdfDeRotulo(id(req.params.id))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(pdf.nombre)}`)
    res.send(pdf.contenido)
  } catch (error) {
    responderError(res, error)
  }
})

export default router
