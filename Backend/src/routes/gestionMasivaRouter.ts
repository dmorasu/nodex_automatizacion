import { Router, type Request, type Response } from 'express'
import { Op, literal, type Includeable, type WhereOptions } from 'sequelize'
import { db } from '../config/db'
import { esAnalistaTramites } from '../middleware/auth'
import SolicitudTramites from '../models/solicitudTramites'
import Clientes from '../models/clientes'
import Tramite from '../models/tramite'
import Municipios from '../models/municipios'
import Tramitador from '../models/tramitador'
import Estados from '../models/estados'
import Programacion from '../models/programacion'
import Logistica from '../models/logistica'
import { ATRIBUTO_NOMBRE_ANALISTA } from '../services/analistasTramites'

// =====================================
// GESTIÓN MASIVA EN PANTALLA
// Trae los trámites elegidos (por número o con filtros) con sus valores actuales, para que la tabla editable arranque
// con lo que ya tienen (el proceso masivo reemplaza los campos: un vacío borraría el dato).
// Guardar usa las mismas rutas del cargue por Excel (/api/bulk/<tipo>/validar|procesar)
// enviando { filas } en JSON.
// =====================================

const MAXIMO = 500

const router = Router()

const ESTADOS_CERRADOS = ['Finalizado', 'Desistido']

// Fecha por la que se busca: creación del trámite, diligencia (programación) o finalización
const FECHAS = {
  creacion: { campo: 'createdAt', enProgramacion: false },
  diligencia: { campo: 'fechaProbableEntrega', enProgramacion: true },
  finalizacion: { campo: 'fechaFinalizacionServicio', enProgramacion: true }
} as const

const esFecha = (valor: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ''))

// Rango de días completos en hora de Colombia ("2026-10-05" → 00:00 a 23:59:59 -05:00)
const rango = (desde: unknown, hasta: unknown) => ({
  ...(esFecha(desde) ? { [Op.gte]: new Date(`${desde}T00:00:00-05:00`) } : {}),
  ...(esFecha(hasta) ? { [Op.lte]: new Date(`${hasta}T23:59:59.999-05:00`) } : {})
})

const ATRIBUTOS = ['id', 'placa', 'matriculaInmobiliaria', 'estadoActualTramite', 'tramitadorId', ATRIBUTO_NOMBRE_ANALISTA] as const

const incluir = (whereProgramacion?: WhereOptions): Includeable[] => [
  { model: Clientes, attributes: ['id', 'nombreCliente', 'identificacionCliente'] },
  { model: Tramite, attributes: ['id', 'nombreTramite'] },
  { model: Municipios, attributes: ['id', 'nombreMunicipio'] },
  { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
  { model: Estados, as: 'estadoActual', attributes: ['id', 'nombreEstado'] },
  {
    model: Programacion,
    attributes: ['id', 'fechaProbableEntrega', 'valorTramite', 'valorViaticos', 'conceptoHonorarios', 'conceptoViaticos'],
    ...(whereProgramacion ? { where: whereProgramacion, required: true } : {})
  },
  {
    model: Logistica,
    attributes: ['id', 'numeroGuia', 'destinatario', 'valorEnvio', 'fechaProgramacionLogistica', 'fechaEntregaTransportadora', 'transportadoraId']
  }
]

// GET /api/bulk/tramites/buscar?tramitadorId=&operacionesId=&estado=abiertos|<id>&fecha=creacion|diligencia|finalizacion&desde=&hasta=
// Trámites para la gestión masiva a partir de filtros (sin escribir los números). Hasta 500;
// si hay más, avisa para que se acote la búsqueda. El analista solo encuentra los suyos.
router.get('/buscar', async (req: Request, res: Response) => {
  try {
    const { tramitadorId, operacionesId, estado, desde, hasta } = req.query
    const fecha = FECHAS[String(req.query.fecha) as keyof typeof FECHAS] ?? FECHAS.creacion

    const where: any = {}
    if (tramitadorId === 'sin') where.tramitadorId = null
    else if (Number(tramitadorId) > 0) where.tramitadorId = Number(tramitadorId)
    if (Number(operacionesId) > 0) where.operacionesId = Number(operacionesId)
    if (Number(estado) > 0) where.estadoActualTramite = Number(estado)
    if (esAnalistaTramites(req)) where.analistaAsignado = req.usuario.id

    const filtroFecha = rango(desde, hasta)
    const hayFecha = Object.getOwnPropertySymbols(filtroFecha).length > 0
    if (hayFecha && !fecha.enProgramacion) where[fecha.campo] = filtroFecha

    // Abiertos: todo lo que no esté Finalizado ni Desistido (incluye los que no tienen estado)
    if (estado === 'abiertos') {
      where[Op.and] = [literal(`("SolicitudTramites"."estadoActualTramite" IS NULL OR "SolicitudTramites"."estadoActualTramite" NOT IN (
        SELECT id FROM "Estados" WHERE "nombreEstado" IN (${ESTADOS_CERRADOS.map(e => db.escape(e)).join(', ')})
      ))`)]
    }

    if (!tramitadorId && !operacionesId && !hayFecha) {
      return res.status(400).json({ error: 'Elija al menos un tramitador, una operación o un rango de fechas' })
    }

    const tramites = await SolicitudTramites.findAll({
      where,
      attributes: [...ATRIBUTOS],
      include: incluir(hayFecha && fecha.enProgramacion ? { [fecha.campo]: filtroFecha } : undefined),
      order: [['id', 'ASC']],
      limit: MAXIMO + 1
    })

    if (tramites.length > MAXIMO) {
      return res.status(400).json({ error: `La búsqueda trae más de ${MAXIMO} trámites. Acote los filtros (por ejemplo, un rango de fechas más corto)` })
    }
    res.json({ tramites })
  } catch (error) {
    console.error('GESTIÓN MASIVA - BUSCAR TRÁMITES:', error)
    res.status(500).json({ error: 'No se pudieron buscar los trámites' })
  }
})

// GET /api/bulk/tramites?ids=1,2,3
router.get('/', async (req: Request, res: Response) => {
  try {
    const ids = [...new Set(String(req.query.ids ?? '')
      .split(/[\s,;]+/)
      .map(Number)
      .filter(id => Number.isInteger(id) && id > 0))]

    if (ids.length === 0) return res.json({ tramites: [], noEncontrados: [] })
    if (ids.length > MAXIMO) return res.status(400).json({ error: `Máximo ${MAXIMO} trámites a la vez` })

    const tramites = await SolicitudTramites.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: [...ATRIBUTOS],
      include: incluir()
    })

    // En el orden en que se pidieron
    const porId = new Map(tramites.map(t => [t.id, t]))
    res.json({
      tramites: ids.filter(id => porId.has(id)).map(id => porId.get(id)),
      noEncontrados: ids.filter(id => !porId.has(id))
    })
  } catch (error) {
    console.error('GESTIÓN MASIVA - TRÁMITES:', error)
    res.status(500).json({ error: 'No se pudieron consultar los trámites' })
  }
})

export default router
