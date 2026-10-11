import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import ReembolsosCaja from '../../models/gastos/reembolsosCaja'
import LegalizacionesCaja from '../../models/gastos/legalizacionesCaja'
import TrazabilidadReembolsosCaja from '../../models/gastos/trazabilidadReembolsosCaja'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Bolsas from '../../models/gastos/bolsas'
import Usuarios from '../../models/usuarios'
import {
  actualizarCaja, agregarAlReembolso, anularReembolso, aprobarReembolso, asignarCaja, cajaDelUsuario, crearCaja,
  crearReembolso, deshacerLegalizacionCaja, enviarReembolso, legalizarGastoCaja, legalizarReembolso, pagarConCaja,
  quitarDelReembolso, rechazarReembolso, resumenCajas, revisarTopeCaja, usuariosDeCajas, historialCaja, cajaBloqueada,
  type FiltrosHistorialCaja
} from '../../services/gastos/cajaMenor'
import { generarExcelHistorialCaja } from '../../services/gastos/excelCajaMenor'
import { notificarReembolsoEnviado, notificarReembolsoRevisado, notificarTopeCaja } from '../../services/gastos/notificacionesGastos'
import { ROLES } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { ATRIBUTOS_USUARIO, esAuxiliarCaja, responderError } from './utilidades'

// Cajas que puede manejar el usuario: todas (Tesorería, Administrador) o solo la suya
// (Auxiliar de Tesorería - Caja menor). null = todas
const cajasPermitidas = async (req: Request): Promise<number[] | null> => {
  if (!esAuxiliarCaja(req)) return null
  const caja = await cajaDelUsuario(req.usuario.id)
  return caja ? [caja.id] : []
}

const verificarCaja = async (req: Request, bolsaId: number) => {
  const permitidas = await cajasPermitidas(req)
  if (permitidas && !permitidas.includes(bolsaId)) throw new ErrorGastos('No tiene acceso a esa caja menor', 403)
}

const verificarGasto = async (req: Request, gastoId: number) => {
  const gasto = await SolicitudesGasto.findByPk(gastoId, { attributes: ['id', 'bolsaId'] })
  if (!gasto) throw new ErrorGastos('El gasto no existe', 404)
  await verificarCaja(req, gasto.bolsaId)
}

// Dirección de Negocio ve todos los reembolsos (los aprueba); Tesorería y la auxiliar, los de sus cajas
const verificarReembolso = async (req: Request, id: number) => {
  const reembolso = await ReembolsosCaja.findByPk(id, { attributes: ['id', 'bolsaId'] })
  if (!reembolso) throw new ErrorGastos('El reembolso no existe', 404)
  if (!(req.roles ?? []).includes(ROLES.DIRECCION_NEGOCIO)) await verificarCaja(req, reembolso.bolsaId)
  return reembolso
}

const archivos = (req: Request) => (req.files ?? []) as Express.Multer.File[]

const filtrosHistorial = (req: Request): FiltrosHistorialCaja => ({
  estado: (req.query.estado as string) || null,
  desde: (req.query.desde as string) || null,
  hasta: (req.query.hasta as string) || null,
  quienLegaliza: (req.query.quienLegaliza as string) || null,
  busqueda: (req.query.busqueda as string) || null
})

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const nombreArchivo = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

// Después de mover el saldo: avisa a Tesorería si la caja bajó del tope
const revisarTope = (bolsaId: number) => void revisarTopeCaja(bolsaId, notificarTopeCaja)

export class CajaMenorController {

  // GET /caja-menor/cajas → saldo, comprometido y cuadre de cada caja visible
  static cajas = async (req: Request, res: Response) => {
    try {
      res.json(await resumenCajas(await cajasPermitidas(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /caja-menor/cajas/:id/historial?estado=&desde=&hasta=&quienLegaliza=&busqueda=&pagina=&tamano=
  // Gastos pagados por la caja con su legalización y su reembolso; totales de todo lo filtrado
  static historial = async (req: Request, res: Response) => {
    try {
      const bolsaId = Number(req.params.id)
      await verificarCaja(req, bolsaId)
      const { totales, gastos } = await historialCaja(bolsaId, filtrosHistorial(req))
      const pagina = Math.max(1, Number(req.query.pagina) || 1)
      const tamano = Math.min(100, Number(req.query.tamano) || 30)
      res.json({ totales, total: gastos.length, pagina, tamano, registros: gastos.slice((pagina - 1) * tamano, pagina * tamano) })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /caja-menor/cajas/:id/historial/exportar (mismos filtros) → Excel
  static exportarHistorial = async (req: Request, res: Response) => {
    try {
      const bolsaId = Number(req.params.id)
      await verificarCaja(req, bolsaId)
      const caja = await cajaBloqueada(bolsaId)
      const filtros = filtrosHistorial(req)
      const archivo = generarExcelHistorialCaja(caja, await historialCaja(bolsaId, filtros), filtros)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="historial-${nombreArchivo(caja.nombre)}-${hoy()}.xlsx"`)
      res.send(archivo)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/cajas  { nombre, fondo, topeAlerta }
  static crearCaja = async (req: Request, res: Response) => {
    try {
      const caja = await crearCaja(req.body, req.usuario.id)
      res.status(201).json({ id: caja.id })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /caja-menor/cajas/:id  { nombre?, fondo?, topeAlerta?, activo? }
  static actualizarCaja = async (req: Request, res: Response) => {
    try {
      const caja = await actualizarCaja(Number(req.params.id), req.body, req.usuario.id)
      revisarTope(caja.id)
      res.json('Caja actualizada')
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /caja-menor/usuarios → asignaciones y la lista de usuarios para asignar
  static usuarios = async (req: Request, res: Response) => {
    try {
      const [asignaciones, usuarios] = await Promise.all([
        usuariosDeCajas(null),
        Usuarios.findAll({ attributes: ['id', 'nombreUsuario', 'correoUsuario'], order: [['nombreUsuario', 'ASC']] })
      ])
      res.json({
        asignaciones: asignaciones.map(a => ({ usuarioId: a.usuarioId, bolsaId: a.bolsaId })),
        usuarios
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  // PUT /caja-menor/usuarios/:usuarioId  { bolsaId | null }
  static asignar = async (req: Request, res: Response) => {
    try {
      await asignarCaja(Number(req.params.usuarioId), req.body.bolsaId ? Number(req.body.bolsaId) : null)
      res.json(req.body.bolsaId ? 'Caja asignada' : 'Caja quitada')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/pagar  { bolsaId, fechaPago, observacion, gastos: [{ id, valorEntregado }] }
  static pagar = async (req: Request, res: Response) => {
    try {
      await verificarCaja(req, Number(req.body.bolsaId))
      const { bolsaId, ids } = await pagarConCaja(req.body, req.usuario.id)
      revisarTope(bolsaId)
      res.json({ pagados: ids.length })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/gastos/:id/legalizar  (multipart: datos = JSON, archivos[] = soporte)
  static legalizarGasto = async (req: Request, res: Response) => {
    try {
      await verificarGasto(req, Number(req.params.id))
      const { bolsaId } = await legalizarGastoCaja(Number(req.params.id), req.body, archivos(req), req.usuario.id)
      revisarTope(bolsaId)
      res.json('Gasto legalizado: queda pendiente por reembolso')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/gastos/:id/deshacer
  static deshacerLegalizacion = async (req: Request, res: Response) => {
    try {
      await verificarGasto(req, Number(req.params.id))
      const { bolsaId } = await deshacerLegalizacionCaja(Number(req.params.id), req.usuario.id)
      revisarTope(bolsaId)
      res.json('Se deshizo la legalización')
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /caja-menor/reembolsos?bolsaId=&estado=A,B&pagina=&tamano=
  static reembolsos = async (req: Request, res: Response) => {
    try {
      const direccion = (req.roles ?? []).includes(ROLES.DIRECCION_NEGOCIO)
      const permitidas = direccion ? null : await cajasPermitidas(req)
      const bolsaId = Number(req.query.bolsaId) || null
      if (bolsaId && permitidas && !permitidas.includes(bolsaId)) throw new ErrorGastos('No tiene acceso a esa caja menor', 403)

      const pagina = Math.max(1, Number(req.query.pagina) || 1)
      const tamano = Math.min(100, Number(req.query.tamano) || 20)
      const { count, rows } = await ReembolsosCaja.findAndCountAll({
        where: {
          ...(bolsaId ? { bolsaId } : permitidas ? { bolsaId: permitidas } : {}),
          ...(req.query.estado ? { estado: String(req.query.estado).split(',') } : {})
        },
        include: [
          { model: Bolsas, attributes: ['id', 'nombre'] },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'aprobador', attributes: ATRIBUTOS_USUARIO }
        ],
        attributes: {
          include: [[ReembolsosCaja.sequelize!.literal(`(SELECT COUNT(*) FROM gastos_legalizaciones_caja l WHERE l.reembolso_caja_id = "ReembolsosCaja"."id")`), 'cantidadGastos']]
        },
        order: [['createdAt', 'DESC']],
        limit: tamano,
        offset: (pagina - 1) * tamano
      })
      res.json({ total: count, pagina, tamano, registros: rows })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /caja-menor/reembolsos/:id → con sus gastos, la legalización y los soportes de cada uno
  static reembolso = async (req: Request, res: Response) => {
    try {
      const { id } = await verificarReembolso(req, Number(req.params.id))
      const reembolso = (await ReembolsosCaja.findByPk(id, {
        include: [
          { model: Bolsas, attributes: ['id', 'nombre'] },
          { model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'aprobador', attributes: ATRIBUTOS_USUARIO },
          { model: Usuarios, as: 'legalizador', attributes: ATRIBUTOS_USUARIO },
          { model: TrazabilidadReembolsosCaja, include: [{ model: Usuarios, attributes: ATRIBUTOS_USUARIO }] },
          {
            model: LegalizacionesCaja,
            include: [{
              model: SolicitudesGasto,
              attributes: ['id', 'codigo', 'conceptoPago', 'valorRealmentePagado', 'fechaPago', 'creadoPor'],
              include: [{ model: Usuarios, as: 'creador', attributes: ATRIBUTOS_USUARIO }]
            }]
          }
        ],
        order: [
          [{ model: LegalizacionesCaja, as: 'legalizaciones' }, 'id', 'ASC'],
          [{ model: TrazabilidadReembolsosCaja, as: 'historial' }, 'id', 'ASC']
        ]
      }))!

      const gastoIds = reembolso.legalizaciones.map(l => l.solicitudGastoId)
      const atributos = ['id', 'solicitudGastoId', 'reembolsoCajaId', 'nombreOriginal', 'tipoArchivo', 'tamano', 'subidoPor', 'createdAt']
      const incluir = [{ model: TiposDocumentoGasto, attributes: ['id', 'codigo', 'nombre'] }, { model: Usuarios, attributes: ATRIBUTOS_USUARIO }]
      const [soportesGastos, soportesReembolso] = await Promise.all([
        gastoIds.length ? DocumentosGasto.findAll({ where: { solicitudGastoId: { [Op.in]: gastoIds } }, attributes: atributos, include: incluir }) : [],
        DocumentosGasto.findAll({ where: { reembolsoCajaId: reembolso.id }, attributes: atributos, include: incluir })
      ])

      const json = reembolso.toJSON()
      const roles = req.roles ?? []
      const direccion = roles.includes(ROLES.DIRECCION_NEGOCIO) || roles.includes(ROLES.ADMIN)
      const tesoreria = roles.some(r => ([ROLES.TESORERIA, ROLES.AUXILIAR_TESORERIA_CAJA, ROLES.ADMIN] as string[]).includes(r))
      res.json({
        ...json,
        legalizaciones: json.legalizaciones.map((l: { solicitudGastoId: number }) => ({
          ...l,
          documentos: soportesGastos.filter(d => d.solicitudGastoId === l.solicitudGastoId)
        })),
        documentos: soportesReembolso,
        permisos: {
          editar: tesoreria && reembolso.estado === 'BORRADOR',
          aprobar: direccion && reembolso.estado === 'POR_APROBAR',
          legalizar: tesoreria && reembolso.estado === 'APROBADO'
        }
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/reembolsos  { bolsaId, gastoIds, observacion }
  static crearReembolso = async (req: Request, res: Response) => {
    try {
      await verificarCaja(req, Number(req.body.bolsaId))
      const reembolso = await crearReembolso(req.body, req.usuario.id)
      res.status(201).json({ id: reembolso.id, codigo: reembolso.codigo })
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/reembolsos/:id/agregar | quitar  { gastoIds }
  static agregar = async (req: Request, res: Response) => {
    try {
      await verificarReembolso(req, Number(req.params.id))
      await agregarAlReembolso(Number(req.params.id), req.body.gastoIds, req.usuario.id)
      res.json('Gastos agregados')
    } catch (error) {
      responderError(res, error)
    }
  }

  static quitar = async (req: Request, res: Response) => {
    try {
      await verificarReembolso(req, Number(req.params.id))
      await quitarDelReembolso(Number(req.params.id), req.body.gastoIds, req.usuario.id)
      res.json('Gastos quitados del reembolso')
    } catch (error) {
      responderError(res, error)
    }
  }

  static enviar = async (req: Request, res: Response) => {
    try {
      await verificarReembolso(req, Number(req.params.id))
      const reembolso = await enviarReembolso(Number(req.params.id), req.usuario.id)
      void notificarReembolsoEnviado(reembolso.id)
      res.json('Reembolso enviado a Dirección de Negocio')
    } catch (error) {
      responderError(res, error)
    }
  }

  static aprobar = async (req: Request, res: Response) => {
    try {
      const reembolso = await aprobarReembolso(Number(req.params.id), req.usuario.id)
      void notificarReembolsoRevisado(reembolso.id)
      res.json('Reembolso aprobado')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/reembolsos/:id/rechazar  { motivo } → vuelve a borrador
  static rechazar = async (req: Request, res: Response) => {
    try {
      const reembolso = await rechazarReembolso(Number(req.params.id), req.body.motivo, req.usuario.id)
      void notificarReembolsoRevisado(reembolso.id)
      res.json('Reembolso devuelto a Tesorería')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /caja-menor/reembolsos/:id/legalizar  (multipart: datos = { fechaLegalizacion, observacion }, archivos[])
  static legalizar = async (req: Request, res: Response) => {
    try {
      await verificarReembolso(req, Number(req.params.id))
      const reembolso = await legalizarReembolso(Number(req.params.id), req.body, archivos(req), req.usuario.id)
      revisarTope(reembolso.bolsaId)
      res.json('Reembolso legalizado: la caja se repuso')
    } catch (error) {
      responderError(res, error)
    }
  }

  static anular = async (req: Request, res: Response) => {
    try {
      await verificarReembolso(req, Number(req.params.id))
      await anularReembolso(Number(req.params.id), req.usuario.id)
      res.json('Reembolso anulado: sus gastos volvieron a pendientes')
    } catch (error) {
      responderError(res, error)
    }
  }
}
