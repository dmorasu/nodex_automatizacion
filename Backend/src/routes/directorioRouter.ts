import { Router, type Request, type Response } from 'express'
import { datosDirectorio } from '../services/directorioTramitadores'

// Directorio de tramitadores (/api/directorio): Torre de control, administradores y Analista de
// trámites (todos trabajan con el rol de Torre de control; lo exige server.ts)
const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await datosDirectorio())
  } catch (error) {
    console.error('DIRECTORIO DE TRAMITADORES:', error)
    res.status(500).json({ error: 'No se pudo cargar el directorio' })
  }
})

export default router
