import { Router, type Request, type Response } from 'express'
import { Op } from 'sequelize'
import { filasDeLaPeticion } from '../utils/filasMasivas'
import SolicitudTramites from '../models/solicitudTramites'
import SubEstados from '../models/subEstados'
import SubEstadosSolicitud from '../models/subEstadosSolicitud'

// =====================================
// SUBESTADOS MASIVOS (gestión masiva en pantalla, 2026-11-04)
// Cada fila registra un subestado nuevo en el trámite (el actual es el último registrado), igual
// que el botón "Subestado" del detalle. El subestado debe ser del tipo de trámite de la fila.
// Columnas: solicitudTramiteId, subEstadoId, observacionSubEstado (opcional).
// =====================================

type Fila = { solicitudTramiteId: unknown, subEstadoId: unknown, observacionSubEstado?: unknown }
type ErrorFila = { fila: number, error: string }

const router = Router()

// Todos los subestados con su tipo de trámite (la pantalla filtra por el tipo de cada trámite)
router.get('/catalogo', async (_req: Request, res: Response) => {
  try {
    const subestados = await SubEstados.findAll({ attributes: ['id', 'nombre', 'tramiteId'], order: [['nombre', 'ASC']] })
    res.json(subestados)
  } catch (error) {
    console.error('SUBESTADOS MASIVOS - CATÁLOGO:', error)
    res.status(500).json({ error: 'No se pudieron cargar los subestados' })
  }
})

// "fila" como en el Excel: el encabezado es la 1
const validar = async (filas: Fila[]) => {
  const errores: ErrorFila[] = []
  const ids = [...new Set(filas.map(f => Number(f.solicitudTramiteId)).filter(n => Number.isInteger(n) && n > 0))]
  const subIds = [...new Set(filas.map(f => Number(f.subEstadoId)).filter(n => Number.isInteger(n) && n > 0))]
  const tramites: SolicitudTramites[] = ids.length ? await SolicitudTramites.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'tramiteId'] }) : []
  const subestados: SubEstados[] = subIds.length ? await SubEstados.findAll({ where: { id: { [Op.in]: subIds } }, attributes: ['id', 'nombre', 'tramiteId'] }) : []
  const tipoDe = new Map<number, number>(tramites.map(t => [t.id, Number(t.tramiteId)]))
  const subDe = new Map<number, SubEstados>(subestados.map(s => [s.id, s]))

  filas.forEach((f, i) => {
    const fila = i + 2
    const id = Number(f.solicitudTramiteId)
    const sub = subDe.get(Number(f.subEstadoId))
    if (!tipoDe.has(id)) return errores.push({ fila, error: `No existe el trámite ${f.solicitudTramiteId ?? ''}`.trim() })
    if (!f.subEstadoId) return errores.push({ fila, error: 'Elija el subestado' })
    if (!sub) return errores.push({ fila, error: `No existe el subestado ${f.subEstadoId}` })
    if (Number(sub.tramiteId) !== tipoDe.get(id)) return errores.push({ fila, error: `"${sub.nombre}" no es un subestado de este tipo de trámite` })
    if (String(f.observacionSubEstado ?? '').length > 2000) return errores.push({ fila, error: 'La observación puede tener máximo 2000 caracteres' })
  })
  return errores
}

router.post('/validar', async (req: Request, res: Response) => {
  try {
    const filas = filasDeLaPeticion(req)
    if (typeof filas === 'string') return res.status(400).json({ error: filas })
    res.json({ totalProcesados: filas.length, errores: await validar(filas as Fila[]) })
  } catch (error) {
    console.error('SUBESTADOS MASIVOS - VALIDAR:', error)
    res.status(500).json({ error: 'No se pudieron validar los subestados' })
  }
})

// Si alguna fila no es válida no se guarda ninguna; si falla al guardar, se informa esa fila
router.post('/procesar', async (req: Request, res: Response) => {
  try {
    const filas = filasDeLaPeticion(req)
    if (typeof filas === 'string') return res.status(400).json({ error: filas })
    const errores = await validar(filas as Fila[])
    if (errores.length) return res.status(400).json({ errores })

    const fallas: ErrorFila[] = []
    for (const [i, f] of (filas as Fila[]).entries()) {
      try {
        await SubEstadosSolicitud.create({
          solicitudTramiteId: Number(f.solicitudTramiteId),
          subEstadoId: Number(f.subEstadoId),
          observacion: String(f.observacionSubEstado ?? '').trim() || null
        })
      } catch (error) {
        console.error('SUBESTADOS MASIVOS - FILA', i + 2, error)
        fallas.push({ fila: i + 2, error: 'No se pudo registrar el subestado' })
      }
    }
    res.json({ message: 'Subestados registrados', totalProcesados: filas.length - fallas.length, errores: fallas })
  } catch (error) {
    console.error('SUBESTADOS MASIVOS - PROCESAR:', error)
    res.status(500).json({ error: 'No se pudieron registrar los subestados' })
  }
})

export default router
