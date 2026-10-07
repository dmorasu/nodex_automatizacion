import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import Operaciones from '../../models/operaciones'
import Tramitador from '../../models/tramitador'
import SolicitudTramites from '../../models/solicitudTramites'
import Clientes from '../../models/clientes'
import Tramite from '../../models/tramite'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import { ErrorGastos } from '../../services/gastos/errores'
import { TIPOS_BOLSA } from '../../services/gastos/constantes'
import { responderError } from './utilidades'

// Datos de apoyo para el formulario de gastos (selects y autocompletado)
export class ApoyoGastosController {

  static operaciones = async (req: Request, res: Response) => {
    try {
      const operaciones = await Operaciones.findAll({
        attributes: ['id', 'nombreOperacion', 'centroDeCostos'],
        order: [['nombreOperacion', 'ASC']]
      })
      res.json(operaciones)
    } catch (error) {
      responderError(res, error)
    }
  }

  // Bolsas activas para elegir al crear el gasto (sin saldo: eso lo ve Tesorería).
  // ?tipo=ANTICIPOS para el formulario del anticipo; por defecto las generales (las de
  // anticipos solo pagan gastos creados desde un anticipo)
  static bolsas = async (req: Request, res: Response) => {
    try {
      const bolsas = await Bolsas.findAll({
        where: { activo: true, tipo: req.query.tipo === TIPOS_BOLSA.ANTICIPOS ? TIPOS_BOLSA.ANTICIPOS : TIPOS_BOLSA.GENERAL },
        attributes: ['id', 'nombre', 'lineaNegocio', 'tipo'],
        order: [['nombre', 'ASC']]
      })
      res.json(bolsas)
    } catch (error) {
      responderError(res, error)
    }
  }

  static tramitadores = async (req: Request, res: Response) => {
    try {
      const tramitadores = await Tramitador.findAll({
        where: { activo: true },
        attributes: ['id', 'nombreTramitador', 'identificacion'],
        order: [['nombreTramitador', 'ASC']]
      })
      res.json(tramitadores)
    } catch (error) {
      responderError(res, error)
    }
  }

  // Datos del trámite para precargar el gasto (operación, tramitador, placa/matrícula)
  static tramite = async (req: Request, res: Response) => {
    try {
      const tramite = await SolicitudTramites.findByPk(Number(req.params.id), {
        attributes: ['id', 'operacionesId', 'tramitadorId', 'placa', 'matriculaInmobiliaria'],
        include: [
          { model: Clientes, attributes: ['nombreCliente', 'identificacionCliente'] },
          { model: Tramite, attributes: ['nombreTramite'] },
          { model: Operaciones, attributes: ['nombreOperacion'] },
          { model: Tramitador, attributes: ['nombreTramitador'] }
        ]
      })

      if (!tramite) throw new ErrorGastos(`No existe el trámite ${req.params.id}`, 404)

      res.json(tramite)
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /terceros?busqueda=  → hasta 20 coincidencias por identificación o nombre
  static terceros = async (req: Request, res: Response) => {
    try {
      const busqueda = String(req.query.busqueda ?? '').trim()

      if (busqueda.length < 3) return res.json([])

      const terceros = await Terceros.findAll({
        where: {
          activo: true,
          [Op.or]: [
            { identificacion: { [Op.iLike]: `${busqueda}%` } },
            { nombre: { [Op.iLike]: `%${busqueda}%` } }
          ]
        },
        attributes: ['id', 'tipoIdentificacion', 'identificacion', 'nombre', 'banco', 'tipoCuenta', 'numeroCuenta', 'correo', 'telefono', 'direccion'],
        order: [['nombre', 'ASC']],
        limit: 20
      })

      res.json(terceros)
    } catch (error) {
      responderError(res, error)
    }
  }
}
