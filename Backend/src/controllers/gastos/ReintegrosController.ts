import type { Request, Response } from 'express'
import Reintegros from '../../models/gastos/reintegros'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Tramitador from '../../models/tramitador'
import Terceros from '../../models/gastos/terceros'
import Usuarios from '../../models/usuarios'
import { estadosReintegro, marcarReintegrado } from '../../services/gastos/reintegros'
import { ATRIBUTOS_USUARIO, responderError } from './utilidades'

export class ReintegrosController {

  // GET /reintegros?estado=PENDIENTE|REINTEGRADO&pagina=&tamano=
  static getAll = async (req: Request, res: Response) => {
    try {
      const pagina = Number(req.query.pagina ?? 1)
      const tamano = Number(req.query.tamano ?? 30)

      const { count, rows } = await Reintegros.findAndCountAll({
        where: req.query.estado ? { estadoId: await estadosReintegro.id(req.query.estado as never) } : {},
        include: [
          { model: EstadosReintegro, attributes: ['id', 'codigo', 'nombre'] },
          { model: Usuarios, as: 'registrador', attributes: ATRIBUTOS_USUARIO },
          {
            model: SolicitudesGasto,
            attributes: ['id', 'codigo', 'conceptoPago', 'valorRealmentePagado'],
            include: [
              { model: Tramitador, attributes: ['id', 'nombreTramitador'] },
              { model: Terceros, attributes: ['id', 'nombre'] }
            ]
          }
        ],
        order: [['id', 'DESC']],
        limit: tamano,
        offset: (pagina - 1) * tamano
      })

      res.json({ total: count, pagina, tamano, registros: rows })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /reintegros/:id/reintegrar  { fechaReintegro }
  static reintegrar = async (req: Request, res: Response) => {
    try {
      await marcarReintegrado(Number(req.params.id), req.body.fechaReintegro, req.usuario.id)
      res.json('Reintegro registrado en la bolsa')
    } catch (error) {
      responderError(res, error)
    }
  }
}
