import type { Request, Response } from 'express'
import { db } from '../../config/db'
import Bolsas from '../../models/gastos/bolsas'
import MovimientosBolsa from '../../models/gastos/movimientosBolsa'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Usuarios from '../../models/usuarios'
import { registrarMovimientos } from '../../services/gastos/bolsas'
import { TIPOS_MOVIMIENTO_BOLSA } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, responderError } from './utilidades'

// Administración de bolsas (Tesorería / Admin).
// El saldo NO se edita aquí: solo cambia con movimientos (recargas, pagos, ...)
export class BolsasController {

  static getAll = async (req: Request, res: Response) => {
    try {
      const bolsas = await Bolsas.findAll({
        attributes: ['id', 'nombre', 'lineaNegocio', 'saldoActual', 'activo'],
        order: [['activo', 'DESC'], ['nombre', 'ASC']]
      })
      res.json(bolsas)
    } catch (error) {
      responderError(res, error)
    }
  }

  static create = async (req: Request, res: Response) => {
    try {
      const { nombre, lineaNegocio } = req.body

      if (await Bolsas.findOne({ where: { nombre } })) {
        throw new ErrorGastos(`Ya existe una bolsa llamada ${nombre}`, 409)
      }

      const bolsa = await Bolsas.create({ nombre, lineaNegocio: lineaNegocio || null })
      res.status(201).json({ id: bolsa.id })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /bolsas/:id/recargas  { valor, observacion }
  static recargar = async (req: Request, res: Response) => {
    try {
      const { saldoFinal } = await db.transaction(transaction =>
        registrarMovimientos(Number(req.params.id), [{
          tipo: TIPOS_MOVIMIENTO_BOLSA.RECARGA,
          valor: Number(req.body.valor),
          observacion: req.body.observacion || null
        }], req.usuario.id, transaction)
      )

      res.status(201).json({ saldo: saldoFinal })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /bolsas/:id/ajustes  { valor (±), observacion }  — solo ADMIN
  static ajustar = async (req: Request, res: Response) => {
    try {
      const { saldoFinal } = await db.transaction(transaction =>
        registrarMovimientos(Number(req.params.id), [{
          tipo: TIPOS_MOVIMIENTO_BOLSA.AJUSTE,
          valor: Number(req.body.valor),
          observacion: req.body.observacion
        }], req.usuario.id, transaction)
      )

      res.status(201).json({ saldo: saldoFinal })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /bolsas/:id/movimientos?pagina=&tamano=  (más recientes primero)
  static movimientos = async (req: Request, res: Response) => {
    try {
      const bolsa = await Bolsas.findByPk(Number(req.params.id), {
        attributes: ['id', 'nombre', 'lineaNegocio', 'saldoActual', 'activo']
      })
      if (!bolsa) throw new ErrorGastos('La bolsa no existe', 404)

      const pagina = Number(req.query.pagina ?? 1)
      const tamano = Number(req.query.tamano ?? 30)

      const { count, rows } = await MovimientosBolsa.findAndCountAll({
        where: { bolsaId: bolsa.id },
        attributes: ['id', 'tipo', 'valor', 'saldoResultante', 'lotePagoId', 'observacion', 'createdAt'],
        include: [
          { model: SolicitudesGasto, attributes: ['id', 'codigo'] },
          { model: Usuarios, attributes: ATRIBUTOS_USUARIO }
        ],
        order: [['id', 'DESC']],
        limit: tamano,
        offset: (pagina - 1) * tamano
      })

      res.json({ bolsa, total: count, pagina, tamano, registros: rows })
    } catch (error) {
      responderError(res, error)
    }
  }

  static update = async (req: Request, res: Response) => {
    try {
      const bolsa = await Bolsas.findByPk(Number(req.params.id))
      if (!bolsa) throw new ErrorGastos('La bolsa no existe', 404)

      const { nombre, lineaNegocio, activo } = req.body

      await bolsa.update({
        ...(nombre !== undefined && { nombre }),
        ...(lineaNegocio !== undefined && { lineaNegocio: lineaNegocio || null }),
        ...(activo !== undefined && { activo })
      })

      res.json('Bolsa actualizada')
    } catch (error) {
      responderError(res, error)
    }
  }
}
