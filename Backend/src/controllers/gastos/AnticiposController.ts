import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import Anticipos from '../../models/gastos/anticipos'
import TrazabilidadAnticipos from '../../models/gastos/trazabilidadAnticipos'
import ClientesEmpresariales from '../../models/gastos/clientesEmpresariales'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import EstadosGasto from '../../models/gastos/estadosGasto'
import Operaciones from '../../models/operaciones'
import Usuarios from '../../models/usuarios'
import {
  actualizarAnticipo, anularAnticipo, confirmarAnticipos, contarAnticipos, crearAnticipo, listarAnticipos,
  marcarNovedad, saldoDelCliente
} from '../../services/gastos/anticipos'
import { notificarAnticiposConfirmados, notificarNovedadAnticipo } from '../../services/gastos/notificacionesAnticipos'
import { ESTADOS_ANTICIPO, ROLES } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, esAdmin, puedeVerTodos, responderError } from './utilidades'

// Quien no puede ver el anticipo recibe 404 (no se revela que existe).
// Lo ven quien lo creó y cualquier rol del módulo de gastos.
export const obtenerAnticipoConAcceso = async (req: Request, id: number) => {
  const anticipo = await Anticipos.findByPk(id)
  if (!anticipo || (!puedeVerTodos(req) && anticipo.creadoPor !== req.usuario.id)) {
    throw new ErrorGastos('El anticipo no existe', 404)
  }
  return anticipo
}

const esCreadorOAdmin = (req: Request, anticipo: Anticipos) => anticipo.creadoPor === req.usuario.id || esAdmin(req)
const esContabilidad = (req: Request) => esAdmin(req) || (req.roles ?? []).includes(ROLES.CONTABILIDAD)

const archivos = (req: Request) => (req.files ?? []) as Express.Multer.File[]

export class AnticiposController {

  // GET /anticipos?alcance=mios|todos&estado=A,B&tipo=&bolsaId=&busqueda=&pagina=&tamano=
  static listar = async (req: Request, res: Response) => {
    try {
      const soloMios = req.query.alcance !== 'todos' || !puedeVerTodos(req)
      res.json(await listarAnticipos({
        creadoPor: soloMios ? req.usuario.id : null,
        estado: (req.query.estado as string) || null,
        tipo: (req.query.tipo as string) || null,
        bolsaId: Number(req.query.bolsaId) || null,
        busqueda: (req.query.busqueda as string) || null,
        pagina: Number(req.query.pagina) || 1,
        tamano: Number(req.query.tamano) || 20
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /anticipos/resumen → pendientes para la pantalla de inicio
  static resumen = async (req: Request, res: Response) => {
    try {
      const [porConfirmar, conNovedad, confirmadosSinGasto] = await Promise.all([
        esContabilidad(req) ? contarAnticipos(ESTADOS_ANTICIPO.POR_CONFIRMAR) : Promise.resolve(0),
        contarAnticipos(ESTADOS_ANTICIPO.NOVEDAD, req.usuario.id),
        // Confirmados de los que aún no se ha creado ningún gasto
        Anticipos.count({
          where: {
            creadoPor: req.usuario.id,
            estado: ESTADOS_ANTICIPO.CONFIRMADO,
            id: { [Op.notIn]: Anticipos.sequelize!.literal('(SELECT g.anticipo_id FROM gastos_solicitudes g WHERE g.anticipo_id IS NOT NULL)') }
          }
        })
      ])
      res.json({ porConfirmar, conNovedad, confirmadosSinGasto })
    } catch (error) {
      responderError(res, error)
    }
  }

  static detalle = async (req: Request, res: Response) => {
    try {
      const { id } = await obtenerAnticipoConAcceso(req, Number(req.params.id))
      const anticipo = (await Anticipos.findByPk(id, {
        include: [
          { model: Terceros, attributes: ['id', 'tipoIdentificacion', 'identificacion', 'nombre', 'telefono', 'direccion'] },
          { model: ClientesEmpresariales, attributes: ['id', 'nombre'] },
          { model: Bolsas, attributes: ['id', 'nombre', 'tipo'] },
          { model: Operaciones, attributes: ['id', 'nombreOperacion', 'centroDeCostos'] },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'confirmador', attributes: ATRIBUTOS_USUARIO },
          { model: TrazabilidadAnticipos, include: [{ model: Usuarios, attributes: ATRIBUTOS_USUARIO }] },
          {
            model: DocumentosGasto,
            attributes: ['id', 'nombreOriginal', 'tipoArchivo', 'tamano', 'subidoPor', 'createdAt'],
            include: [{ model: TiposDocumentoGasto, attributes: ['id', 'nombre'] }, { model: Usuarios, attributes: ATRIBUTOS_USUARIO }]
          },
          {
            model: SolicitudesGasto,
            attributes: ['id', 'codigo', 'conceptoPago', 'valorSolicitadoPago', 'valorProgramado', 'valorRealmentePagado', 'fechaPago', 'createdAt'],
            include: [{ model: EstadosGasto, attributes: ['codigo', 'nombre'] }]
          }
        ],
        order: [
          [{ model: TrazabilidadAnticipos, as: 'trazabilidad' }, 'createdAt', 'ASC'],
          [{ model: DocumentosGasto, as: 'documentos' }, 'createdAt', 'DESC'],
          [{ model: SolicitudesGasto, as: 'gastos' }, 'createdAt', 'ASC']
        ]
      }))!

      const editable = [ESTADOS_ANTICIPO.POR_CONFIRMAR, ESTADOS_ANTICIPO.NOVEDAD].includes(anticipo.estado as 'NOVEDAD')
      const confirmado = anticipo.estado === ESTADOS_ANTICIPO.CONFIRMADO

      res.json({
        ...anticipo.toJSON(),
        // Saldo del cliente en la bolsa (todos sus anticipos menos sus gastos)
        saldoCliente: confirmado ? await saldoDelCliente(anticipo.bolsaId, anticipo.clienteId) : null,
        permisos: {
          editar: esCreadorOAdmin(req, anticipo) && editable,
          anular: esCreadorOAdmin(req, anticipo) && editable,
          revisar: esContabilidad(req) && anticipo.estado === ESTADOS_ANTICIPO.POR_CONFIRMAR,
          crearGasto: esCreadorOAdmin(req, anticipo) && confirmado
        }
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /anticipos  (multipart: datos = JSON, archivos[] = soporte de la consignación)
  static crear = async (req: Request, res: Response) => {
    try {
      const anticipo = await crearAnticipo(req.body, archivos(req), req.usuario.id)
      res.status(201).json({ id: anticipo.id, codigo: anticipo.codigo })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /anticipos/:id  (multipart; archivos opcionales). Con novedad, vuelve a Contabilidad
  static actualizar = async (req: Request, res: Response) => {
    try {
      const anticipo = await obtenerAnticipoConAcceso(req, Number(req.params.id))
      if (!esCreadorOAdmin(req, anticipo)) throw new ErrorGastos('Solo quien registró el anticipo puede corregirlo', 403)

      const { reenviado } = await actualizarAnticipo(anticipo.id, req.body, archivos(req), req.usuario.id)
      res.json({ id: anticipo.id, reenviado })
    } catch (error) {
      responderError(res, error)
    }
  }

  static anular = async (req: Request, res: Response) => {
    try {
      const anticipo = await obtenerAnticipoConAcceso(req, Number(req.params.id))
      if (!esCreadorOAdmin(req, anticipo)) throw new ErrorGastos('Solo quien registró el anticipo puede anularlo', 403)

      await anularAnticipo(anticipo.id, req.body.motivo, req.usuario.id)
      res.json('Anticipo anulado')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /anticipos/:id/novedad  { motivo } — Contabilidad lo devuelve al creador
  static novedad = async (req: Request, res: Response) => {
    try {
      const anticipo = await marcarNovedad(Number(req.params.id), req.body.motivo, req.usuario.id)
      void notificarNovedadAnticipo(anticipo.id)
      res.json('Anticipo devuelto al creador con la novedad')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /anticipos/confirmar  { anticipos: [{ id, valorRecibido, reciboCaja, observacion }] }
  static confirmar = async (req: Request, res: Response) => {
    try {
      const ids = await confirmarAnticipos(req.body.anticipos, req.usuario.id)
      void notificarAnticiposConfirmados(ids)
      res.json({ confirmados: ids.length })
    } catch (error) {
      responderError(res, error)
    }
  }
}

// ── Clientes empresariales (catálogo) ──
export class ClientesEmpresarialesController {

  // GET /clientes-empresariales?todos=si (con inactivos, para administrarlos)
  static listar = async (req: Request, res: Response) => {
    try {
      res.json(await ClientesEmpresariales.findAll({
        where: req.query.todos === 'si' ? {} : { activo: true },
        attributes: ['id', 'nombre', 'activo'],
        order: [['nombre', 'ASC']]
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  static crear = async (req: Request, res: Response) => {
    try {
      const nombre = String(req.body.nombre ?? '').trim()
      if (!nombre) throw new ErrorGastos('Escriba el nombre del cliente empresarial')
      if (await ClientesEmpresariales.findOne({ where: { nombre: { [Op.iLike]: nombre } } })) {
        throw new ErrorGastos(`Ya existe el cliente empresarial ${nombre}`, 409)
      }
      const cliente = await ClientesEmpresariales.create({ nombre })
      res.status(201).json({ id: cliente.id })
    } catch (error) {
      responderError(res, error)
    }
  }

  static actualizar = async (req: Request, res: Response) => {
    try {
      const cliente = await ClientesEmpresariales.findByPk(Number(req.params.id))
      if (!cliente) throw new ErrorGastos('El cliente empresarial no existe', 404)

      const nombre = req.body.nombre === undefined ? undefined : String(req.body.nombre).trim()
      if (nombre && await ClientesEmpresariales.findOne({ where: { nombre: { [Op.iLike]: nombre }, id: { [Op.ne]: cliente.id } } })) {
        throw new ErrorGastos(`Ya existe el cliente empresarial ${nombre}`, 409)
      }
      await cliente.update({
        ...(nombre ? { nombre } : {}),
        ...(req.body.activo !== undefined ? { activo: req.body.activo === true || req.body.activo === 'true' } : {})
      })
      res.json('Cliente empresarial actualizado')
    } catch (error) {
      responderError(res, error)
    }
  }
}
