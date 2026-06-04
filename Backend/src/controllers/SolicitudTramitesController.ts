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



declare global{
    namespace Express{
        interface Request{
            solicitudTramites?:SolicitudTramites
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
      include: [
        {
          model: Clientes,
          attributes: ["id","nombreCliente","identificacionCliente"]
        },
        {
          model: Municipios,
          attributes: ["id","nombreMunicipio"]
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
      const tramitador = await Tramitador.findByPk(tramitadorId)

      // =========================
      // 🔥 INSTANCIAS RELACIONADAS
      // =========================
      const programacion = solicitud.programacion
      const usuario = solicitud.usuario
      const municipio = solicitud.municipios

      // =========================
      // 🔔 NOTIFICACIÓN
      // =========================
      if (tramitador) {

        await crearNotificacion({
          solicitud,
          tipo: 'ASIGNADO',
          destinatario: tramitador,
          data: {
            nombre: tramitador.nombreTramitador,

            valor: programacion?.valorTramite || 0,

            fecha: programacion?.fechaProbableEntrega
              ? new Date(programacion.fechaProbableEntrega).toLocaleDateString('es-CO')
              : 'Sin fecha',

            solicitante: usuario?.nombreUsuario || 'N/A',

            programador: usuario?.nombreUsuario || 'N/A',

            municipio: municipio?.nombreMunicipio || 'N/A'
          }
        })
      }

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
          attributes: ['id', 'nombreMunicipio'],
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

     static create= async (req:Request, res:Response)=>{

         try {
                const solicitudTramites= new SolicitudTramites(req.body)
                await solicitudTramites.save()
                res.status(201).json("Dato ingresado correctamente")
        } catch (error) {
              console.log(error);
              res.status(500).json({error:'No se puede guardar el registro'})
            
        }

       
    }


     static getById = async (req: Request, res: Response) => {
  try {
    const solicitudTramites = await SolicitudTramites.findByPk(
      req.solicitudTramites.id,
      {
        include: [
          Clientes,
          Municipios,
          

          {
            model: Trazabilidad,
            separate: true,
            order: [["createdAt", "DESC"]],
            limit: 20
          },

          {
            model: EstadosTramites,
            include: [{
              model: Estados,
              attributes: ["nombreEstado"]
            }],
            order: [["createdAt", "DESC"]]
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
        await req.solicitudTramites.update(req.body)
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
      placa,
      fechaFinalizacionDesde,
      fechaFinalizacionHasta,
      page = 1
    } = req.query

    const limit = 10
    const offset = (Number(page) - 1) * limit

    const where: any = {}
    const whereProgramacion: any = {}

    // ==================================================
    // 🔍 BÚSQUEDA POR ID SOLICITUD O IDENTIFICACIÓN CLIENTE
    // ==================================================
    if (search) {
      where[Op.or] = [
        { id: search },
        {
          clienteId: {
            [Op.in]: literal(`(
              SELECT c.id
              FROM "Clientes" c
              WHERE c."identificacionCliente" = '${search}'
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

      include: [
        { model: Clientes, required: false },
        { model: Municipios },
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

static torreControl = async (req:Request,res:Response)=>{

try{

const page = Number(req.query.page) || 1
const limit = 20
const offset = (page-1)*limit

const semaforo = req.query.semaforo
const search = req.query.search

let where = []

if(semaforo){
 where.push(`semaforo='${semaforo}'`)
}

if(search){
 where.push(`
 (
 id::text ILIKE '%${search}%'
 OR estado ILIKE '%${search}%'
 )
 `)
}

const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : ""

const data = await db.query(`
SELECT *
FROM vw_torre_control
${whereClause}
ORDER BY "createdAt" DESC
LIMIT ${limit}
OFFSET ${offset}
`,{
 type:QueryTypes.SELECT
})

type CountResult = { count:number }

const count = await db.query<CountResult>(`
SELECT COUNT(*)::int as count
FROM vw_torre_control
${whereClause}
`,{
 type:QueryTypes.SELECT
})

res.json({
 data,
 total: count[0].count,
 page,
 totalPages: Math.ceil(count[0].count/limit)
})

}catch(error){

console.error(error)
res.status(500).json({error:"error torre control"})

}



}
static panelControl = async (req: Request, res: Response) => {

 try {

 const result = await db.query(`
  SELECT
  COUNT(*) FILTER (WHERE semaforo = 'VENCIDO') as vencidos,
  COUNT(*) FILTER (WHERE semaforo = 'VENCE_HOY') as vencen_hoy,
  COUNT(*) FILTER (WHERE semaforo = 'PROXIMO_A_VENCER') as proximos,
  COUNT(*) FILTER (WHERE semaforo = 'AL_DIA') as al_dia,
  COUNT(*) FILTER (WHERE semaforo = 'CUMPLIDO') as cumplidos
  FROM vw_torre_control
 `,{
  type: QueryTypes.SELECT
 })

 res.json(result[0])

 } catch(error){

 console.error(error)
 res.status(500).json({error:"Error panel control"})

 }

}
}



