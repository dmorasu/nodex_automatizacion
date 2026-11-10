import { Router, type Request, type Response } from 'express'
import { datosDirectorio } from '../services/directorioTramitadores'

// Directorio de tramitadores (/api/directorio): Torre de control, administradores, Analista de
// trámites y, desde el 2026-11-10, Gestión de activos (decisión del usuario; lo exige server.ts)
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
