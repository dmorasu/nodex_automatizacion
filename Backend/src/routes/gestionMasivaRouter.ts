import { Router, type Request, type Response } from 'express'
import { Op } from 'sequelize'
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
// Trae los trámites elegidos con sus valores actuales, para que la tabla editable arranque
// con lo que ya tienen (el proceso masivo reemplaza los campos: un vacío borraría el dato).
// Guardar usa las mismas rutas del cargue por Excel (/api/bulk/<tipo>/validar|procesar)
// enviando { filas } en JSON.
// =====================================

const MAXIMO = 500

const router = Router()

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
      attributes: ['id', 'placa', 'matriculaInmobiliaria', 'estadoActualTramite', 'tramitadorId', ATRIBUTO_NOMBRE_ANALISTA],
      include: [
        { model: Clientes, attributes: ['id', 'nombreCliente', 'identificacionCliente'] },
        { model: Tramite, attributes: ['id', 'nombreTramite'] },
        { model: Municipios, attributes: ['id', 'nombreMunicipio'] },
        { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
        { model: Estados, as: 'estadoActual', attributes: ['id', 'nombreEstado'] },
        {
          model: Programacion,
          attributes: ['id', 'fechaProbableEntrega', 'valorTramite', 'valorViaticos', 'conceptoHonorarios', 'conceptoViaticos']
        },
        {
          model: Logistica,
          attributes: ['id', 'numeroGuia', 'destinatario', 'valorEnvio', 'fechaProgramacionLogistica', 'fechaEntregaTransportadora', 'transportadoraId']
        }
      ]
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
