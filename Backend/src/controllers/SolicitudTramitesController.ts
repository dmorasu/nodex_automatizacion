import type {Request, Response} from 'express'
import SolicitudTramites from '../models/solicitudTramites'
import Trazabilidad from '../models/trazabilidad'
import EstadosTramites from '../models/estadosTramites'
import CuentaCobros from '../models/cuentaCobro'
import Logistica from '../models/logistica'
import Programacion from '../models/programacion'
import Clientes from '../models/clientes'
import Municipios from '../models/municipios'
import {Op,literal,QueryTypes} from 'sequelize'
import Estados from '../models/estados'
import Usuarios from '../models/usuarios'
import { db} from '../config/db'
import Entidad from '../models/entidad'
import Operaciones from '../models/operaciones'
import Tramite from '../models/tramite'
import Tramitador from '../models/tramitador'
import Transportadora from '../models/trasnportadora'
import { crearNotificacion } from '../services/notificacionesServices'
import SubEstadosSolicitud from "../models/subEstadosSolicitud"
import SubEstados from "../models/subEstados"
import TiposRechazo from "../models/tiposRechazos"
import { esAnalistaTramites, puedeAsignarAnalistas, soloTramitesPropios } from '../middleware/auth'
import { ATRIBUTO_NOMBRE_ANALISTA } from '../services/analistasTramites'
import { obtenerTablero } from '../services/tableroTramites'
import { generarExcelTablero } from '../services/exportarTablero'
import { ubicarEnSegundoPlano, ubicarManual } from '../services/mensajeria/ubicacion'




declare global{
    namespace Express{
        interface Request{
            solicitudTramites?:SolicitudTramites
        }
    }
}


// Coordenadas que manda el formulario cuando se eligió un lugar de Google (autocompletado o
// enlace pegado). Sin ellas, la dirección se ubica en segundo plano.
const guardarUbicacionDelFormulario = async (solicitudId: number, body: any) => {
  const latitud = Number(body?.latitud)
  const longitud = Number(body?.longitud)
  if (body?.latitud != null && body?.longitud != null && Number.isFinite(latitud) && Number.isFinite(longitud)) {
    try {
      await ubicarManual(solicitudId, { latitud, longitud }, 'GOOGLE')
      return
    } catch (error) {
      console.warn(`⚠️ No se guardó la ubicación del trámite ${solicitudId}:`, (error as Error).message)
    }
  }
  ubicarEnSegundoPlano(solicitudId)
}

// Filtros del tablero desde la URL. El analista siempre queda limitado a sus trámites.
const filtrosTablero = (req: Request) => {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // YYYY-MM-DD
  const fecha = (valor: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? '')) ? String(valor) : null
  const id = (valor: unknown) => Number(valor) > 0 ? Number(valor) : undefined

  // Período por defecto: últimos 30 días
  const hasta = fecha(req.query.hasta) ?? hoy
  const desde = fecha(req.query.desde) ?? new Date(Date.parse(`${hasta}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10)

  const analistaId = esAnalistaTramites(req)
    ? req.usuario.id
    : req.query.analistaId === 'sin' ? 'sin' as const : id(req.query.analistaId)

  return {
    hoy,
    filtros: {
      desde,
      hasta,
      analistaId,
      tramitadorId: id(req.query.tramitadorId),
      operacionId: id(req.query.operacionId),
      tramiteId: id(req.query.tramiteId),
      estadoId: id(req.query.estadoId)
    }
  }
}

export class SolicitudTramitesController{


static obtenerSolicitudes = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1
    const limit = 10
    const offset = (page - 1) * limit

    const search = (req.query.search as string)?.trim()
    const estado = (req.query.estado as string)?.trim()
    const fechaInicio = req.query.fechaInicio as string
    const fechaFin = req.query.fechaFin as string

    const where:any = {}

    // Gestión de activos solo ve los trámites que creó
    if (soloTramitesPropios(req)) where.usuarioId = req.usuario.id

    // El analista ve en el inicio solo sus trámites; al buscar, encuentra cualquiera
    if (esAnalistaTramites(req) && !search) where.analistaAsignado = req.usuario.id

    // Filtro por analista (id o "sin" = sin analista)
    const analistaId = (req.query.analistaId as string)?.trim()
    if (analistaId === 'sin') where.analistaAsignado = null
    else if (Number(analistaId) > 0) where.analistaAsignado = Number(analistaId)

    // 🔹 ID Solicitud o Identificación Cliente
    if (search) {
      where[Op.or] = [
        { id: { [Op.eq]: search } },
        { "$clientes.identificacionCliente$": { [Op.eq]: search } }
      ]
    }

    // 🔹 Rango de fechas (createdAt)
    if (fechaInicio && fechaFin) {
      where.createdAt = {
        [Op.between]: [new Date(fechaInicio), new Date(fechaFin)]
      }
    }

    // 🔹 Filtro por Estado
    if (estado) {
      if (estado === "Sin Iniciar") {
        where[Op.or] = [
          { "$estadosTramites.estado.nombreEstado$": "Sin Iniciar" },
          { "$estadosTramites.id$": null }
        ]
      } else {
        where["$estadosTramites.estado.nombreEstado$"] = estado
      }
    }

    const { count, rows } = await SolicitudTramites.findAndCountAll({
      where,
      attributes: { include: [ATRIBUTO_NOMBRE_ANALISTA] },
      include: [
        {
          model: Clientes,
          attributes: ["id","nombreCliente","identificacionCliente"]
        },
        {
          model: Municipios,
          attributes: ["id","nombreMunicipio","responsable"]
        },
        {
          model: Operaciones,
          attributes: ["id","nombreOperacion","centroDeCostos"]
        },
        {
          model: Tramite,
          attributes: ["id","nombreTramite","responsable"]
        },
        {
  model: Logistica,
  attributes: ["id","transportadoraId","destinatario"],
  include: [
    {
      model: Transportadora,
      attributes: ["id","nombreTransportadora"]
    }
  ]
},
        {
          model: Usuarios,
          attributes:["id","nombreUsuario"]
        },
        {
          model: Programacion,
          attributes:["id","fechaFinalizacionServicio","fechaRealizacionDiligencia","valorTramite"]
        },
        {
          model: EstadosTramites,
          as: "estadosTramites",
          required: false, // permite trámites sin estado
          include: [{ model: Estados, attributes:["nombreEstado"] }],
          order: [["createdAt","DESC"]],
          limit: 1   // 👈 solo último estado
        },
       
      ],
      order: [["createdAt","DESC"]],
      limit,
      offset,
      distinct: true
    })

    res.json({
      data: rows,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al obtener solicitudes" })
  }
}

static asignarTramitador = async (req: Request, res: Response) => {
    try {

      const { tramitadorId } = req.body

      if (!tramitadorId) {
        return res.status(400).json({ error: 'Debe enviar tramitadorId' })
      }

      // 🔥 TRAER TODO LO NECESARIO
      const solicitud = await SolicitudTramites.findByPk(
        req.solicitudTramites.id,
        {
          include: [
            Programacion,
            Usuarios,
            Municipios
          ]
        }
      )

      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' })
      }

      // =========================
      // UPDATE
      // =========================
      solicitud.tramitadorId = tramitadorId
      await solicitud.save()

      // =========================
      // 🔥 TRAMITADOR
      // =========================
      

      // =========================
      // 🔥 INSTANCIAS RELACIONADAS
      // =========================
      const programacion = solicitud.programacion
      const usuario = solicitud.usuario
      

      // =========================
      // 🔔 NOTIFICACIÓN
      // =========================
      

      return res.status(201).json('Tramitador asignado correctamente')

    } catch (error) {
      console.log(error)
      return res.status(500).json('No se puede guardar el registro')
    }
  }

   
static getAll = async (req: Request, res: Response) => {
  try {
    const solicitudTramites = await SolicitudTramites.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {


          model: EstadosTramites,
          as:'estadosTramites',
         
              
         
          include: [
            {
              model: Estados,
              attributes: ['nombreEstado'], // 👈 solo queremos el nombre del estado
              as:'estado'
            },
          ],
          separate: true, // 👈 importante si quieres traer todos los registros correctamente
          order: [['createdAt', 'DESC']],
          
        },
        {
          model: Clientes,
          attributes: ['id', 'nombreCliente'],
        },
        {
          model: Municipios,
          attributes: ['id', 'nombreMunicipio','responsable'],
        },
        {
          model: Usuarios,
          attributes: ['id', 'nombreUsuario','correoUsuario'],
        },
      ],
    });

    res.json(solicitudTramites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Hubo un error al obtener las solicitudes' });
  }
};

   static create = async (req: Request, res: Response) => {

  try {

    // ==========================================
    // CREAR SOLICITUD
    // ==========================================

    // El analista lo toma del municipio (hook del modelo); solo quien reasigna puede elegirlo
    const { analistaAsignado, ...datos } = req.body
    const solicitudTramites =
      await SolicitudTramites.create(puedeAsignarAnalistas(req) && analistaAsignado ? { ...datos, analistaAsignado } : datos);

    // Ubicación para las rutas de mensajeros: la del lugar elegido en el autocompletado,
    // o se busca la dirección con Google en segundo plano
    await guardarUbicacionDelFormulario(solicitudTramites.id, req.body);


    // ==========================================
    // RESPUESTA
    // ==========================================

    return res.status(201).json({
      mensaje: "Solicitud creada correctamente",

      solicitud: solicitudTramites
    });


  } catch (error) {

    console.error(
      "ERROR AL CREAR SOLICITUD:",
      error
    );

    return res.status(500).json({
      error: "No se puede guardar el registro"
    });

  }

};


     static getById = async (req: Request, res: Response) => {
  try {
    const solicitudTramites = await SolicitudTramites.findByPk(
      req.solicitudTramites.id,
      {
        attributes: { include: [ATRIBUTO_NOMBRE_ANALISTA] },
        include: [
          Clientes,
          {
            model:Municipios,
            attributes: ["id","nombreMunicipio","responsable"]
          },

          
          

          {
            model: Trazabilidad,
            separate: true,
            order: [["createdAt", "DESC"]],
            limit: 20
          },

          {
            // Historial de estados (el orden lo pone el frontend: aquí no aplica sin `separate`)
            model: EstadosTramites,
            include: [
              { model: Estados, attributes: ["nombreEstado"] },
              { model: TiposRechazo, attributes: ["nombre"] }
            ]
          },
          {
            model: Estados,
            as: "estadoActual",
            attributes: ["id", "nombreEstado"]
          },

          // 🔹 Relaciones 1–1 ya corregidas
          {
            model: Programacion
          },
          {
            model: Logistica
          },
          {
            model: CuentaCobros
          },

          {
            model: Usuarios,
            attributes: ["id", "nombreUsuario", "correoUsuario"]
          },
          {
            model:Entidad,
            attributes:["id","nombreEntidad"]

          },
          {
            model:Operaciones,
            attributes:['id','nombreOperacion',"centroDeCostos"]

          },
          {
            model:Tramite,
            attributes:['id','nombreTramite','responsable']
          },
          {
            model:Tramitador,
            attributes:['id','nombreTramitador']
          }
        ]
      }
    )

    res.json(solicitudTramites)

  } catch (error) {
    console.error("ERROR GET SOLICITUD:", error)
    res.status(500).json({ error: error.message })
  }
}


     static updateById = async (req:Request, res:Response)=>{
        // La placa, la matrícula inmobiliaria y el creador no se pueden modificar al editar
        // usuarioId es quien creó el trámite: no cambia al editar
        // El analista se cambia solo por PATCH /:id/analista (Administrador de Torre de control)
        const { placa, matriculaInmobiliaria, usuarioId, analistaAsignado, ...datos } = req.body
        await req.solicitudTramites.update(datos)
        // Lugar elegido en el autocompletado; si no, si cambió la dirección se vuelve a ubicar
        await guardarUbicacionDelFormulario(req.solicitudTramites.id, req.body)
        res.json('Solicitud Actualizada')
    }

     static deleteById= async (req:Request, res:Response)=>{
        await req.solicitudTramites.destroy()
        res.json('tarifa Eliminada')
        
    }


    static buscarSolicitudes = async (req: Request, res: Response) => {
  try {
    const { search } = req.query

    if (!search) {
      return res.json([])
    }

    const solicitudes = await SolicitudTramites.findAll({
      where: {
        [Op.or]: [
          { id: search },
          { '$clientes.identificacionCliente$': search }
        ]
      },
      include: [
        { model: Clientes, attributes: ['id','nombreCliente','identificacionCliente'] },
        { model: EstadosTramites, include: [{ model: Estados }] }
      ],
      order: [['createdAt','DESC']]
    })

    res.json(solicitudes)
  } catch (error) {
    res.status(500).json({ error: 'Error en búsqueda' })
  }
}

static filtrarSolicitudes = async (req: Request, res: Response) => {
  try {
    const {
      search,
      estadoId,
      tramiteId,
      tramitadorId,
      operacionesId,
      analistaId,
      placa,
      fechaFinalizacionDesde,
      fechaFinalizacionHasta,
      page = 1
    } = req.query

    const limit = 10
    const offset = (Number(page) - 1) * limit

    const where: any = {}
    const whereProgramacion: any = {}

    // Gestión de activos solo ve los trámites que creó
    if (soloTramitesPropios(req)) where.usuarioId = req.usuario.id

    // ==================================================
    // 🔍 BÚSQUEDA POR ID SOLICITUD O IDENTIFICACIÓN CLIENTE
    // ==================================================
    if (search) {
      // El texto se escapa (antes iba directo al SQL: inyección SQL).
      // Solo se compara contra el id si es un número, para no generar error en PostgreSQL.
      where[Op.or] = [
        ...(/^\d+$/.test(String(search)) ? [{ id: Number(search) }] : []),
        {
          clienteId: {
            [Op.in]: literal(`(
              SELECT c.id
              FROM "Clientes" c
              WHERE c."identificacionCliente" = ${db.escape(String(search))}
            )`)
          }
        }
      ]
    }

    // ==================================================
    // 🔹 FILTROS DIRECTOS
    // ==================================================
    if (placa) {
      where.placa = { [Op.iLike]: `%${placa}%` }
    }

    if (tramitadorId) {
      where.tramitadorId = tramitadorId
    }

    // Analista: id o "sin" = sin analista
    if (analistaId === 'sin') where.analistaAsignado = null
    else if (Number(analistaId) > 0) where.analistaAsignado = Number(analistaId)

    // El analista ve solo sus trámites; al buscar por número o identificación, encuentra cualquiera
    if (esAnalistaTramites(req) && !search) where.analistaAsignado = req.usuario.id

    // ==================================================
    // 🔹 FILTRO POR FECHA FINALIZACIÓN SERVICIO
    // ==================================================
    if (fechaFinalizacionDesde && fechaFinalizacionHasta) {
      whereProgramacion.fechaFinalizacionServicio = {
        [Op.between]: [
          new Date(fechaFinalizacionDesde as string),
          new Date(fechaFinalizacionHasta as string)
        ]
      }
    }

    if (fechaFinalizacionDesde && !fechaFinalizacionHasta) {
      whereProgramacion.fechaFinalizacionServicio = {
        [Op.gte]: new Date(fechaFinalizacionDesde as string)
      }
    }

    if (!fechaFinalizacionDesde && fechaFinalizacionHasta) {
      whereProgramacion.fechaFinalizacionServicio = {
        [Op.lte]: new Date(fechaFinalizacionHasta as string)
      }
    }

    // ==================================================
    // 🔹 FILTRO POR ESTADO ACTUAL
    // ==================================================
    const SIN_INICIAR_ID = 1

    if (estadoId) {
      if (Number(estadoId) === SIN_INICIAR_ID) {
        where.id = {
          [Op.or]: [
            {
              [Op.in]: literal(`(
                SELECT et."solicitudTramiteId"
                FROM "EstadosTramites" et
                WHERE et."estadoId" = ${SIN_INICIAR_ID}
                AND et."createdAt" = (
                  SELECT MAX(et2."createdAt")
                  FROM "EstadosTramites" et2
                  WHERE et2."solicitudTramiteId" = et."solicitudTramiteId"
                )
              )`)
            },
            {
              [Op.notIn]: literal(`(
                SELECT DISTINCT "solicitudTramiteId"
                FROM "EstadosTramites"
              )`)
            }
          ]
        }
      } else {
        where.id = {
          [Op.in]: literal(`(
            SELECT et."solicitudTramiteId"
            FROM "EstadosTramites" et
            WHERE et."estadoId" = ${estadoId}
            AND et."createdAt" = (
              SELECT MAX(et2."createdAt")
              FROM "EstadosTramites" et2
              WHERE et2."solicitudTramiteId" = et."solicitudTramiteId"
            )
          )`)
        }
      }
    }

    // ==================================================
    // 🔹 QUERY PRINCIPAL
    // ==================================================
    const { rows, count } = await SolicitudTramites.findAndCountAll({
      where,
      attributes: { include: [ATRIBUTO_NOMBRE_ANALISTA] },

      include: [
        { model: Clientes, required: false },
        {
  model: Municipios,
  attributes: [
    "id",
    "nombreMunicipio",
    "responsable"
  ]
},
        {
          model: Tramite,
          required: !!tramiteId,
          where: tramiteId ? { id: tramiteId } : undefined
        },
        {
          model: Operaciones,
          required: !!operacionesId,
          where: operacionesId ? { id: operacionesId } : undefined
        },
        { model: Tramitador },

        // 🔥 NUEVO INCLUDE
        {
          model: Programacion,
          required: !!fechaFinalizacionDesde || !!fechaFinalizacionHasta,
          where: Object.keys(whereProgramacion).length
            ? whereProgramacion
            : undefined
        },

        {
          model: EstadosTramites,
          as: 'estadosTramites',
          separate: true,
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [{ model: Estados }]
        },
        {
          model: Usuarios,
          attributes:["nombreUsuario"]
          
        }
      ],

      distinct: true,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    })

    res.json({
      data: rows,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page)
    })

  } catch (error) {
    console.error('ERROR FILTRAR SOLICITUDES:', error)
    res.status(500).json({ error: 'Error al filtrar solicitudes' })
  }
}

// Tablero de gestión (Torre de control). El analista ve solo sus trámites; el Administrador
// de Torre de control y Admin ven todos y pueden filtrar por analista.
static tablero = async (req: Request, res: Response) => {
  try {
    const { filtros, hoy } = filtrosTablero(req)
    if (filtros.desde > filtros.hasta) return res.status(400).json({ error: 'La fecha inicial no puede ser mayor que la final' })
    res.json(await obtenerTablero(filtros, hoy))
  } catch (error) {
    console.error('TABLERO TRÁMITES:', error)
    res.status(500).json({ error: 'No se pudo cargar el tablero' })
  }
}

// El mismo tablero en Excel, con las listas completas
static exportarTablero = async (req: Request, res: Response) => {
  try {
    const { filtros, hoy } = filtrosTablero(req)
    if (filtros.desde > filtros.hasta) return res.status(400).json({ error: 'La fecha inicial no puede ser mayor que la final' })

    const tablero = await obtenerTablero(filtros, hoy, { sinLimite: true })
    const alcance = esAnalistaTramites(req) ? `Trámites de ${req.usuario.nombreUsuario}` : 'Todos los trámites (según filtros)'
    const archivo = generarExcelTablero(tablero, alcance)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="tablero-tramites-${hoy}.xlsx"`)
    res.send(archivo)
  } catch (error) {
    console.error('EXPORTAR TABLERO TRÁMITES:', error)
    res.status(500).json({ error: 'No se pudo generar el Excel del tablero' })
  }
}
}



