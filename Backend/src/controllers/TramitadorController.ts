import type {Request,Response} from 'express'
import Tramitador from '../models/tramitador'
import SolicitudTramites from '../models/solicitudTramites'
import { Op,Sequelize } from 'sequelize'
import { db } from '../config/db'
import AccesoTramitador from '../models/tramitadores/accesoTramitador'
import { crearORestablecerAcceso, revocarAcceso } from '../services/tramitadores/accesoTramitadores'
import { responderError } from './gastos/utilidades'

declare global{
    namespace Express{
        interface Request{
            tramitador?:Tramitador       
        }
    }
}

export class TramitadorController{
    static getAll =async (req:Request,res:Response) =>{
        try {
                const tramitador=  await Tramitador.findAll({
                    order:[
                        ['nombreTramitador','ASC']
                    ],
                    // Estado del acceso a la app (nunca la contraseña)
                    include: [{ model: AccesoTramitador, attributes: ['debeCambiarContrasena', 'ultimoIngreso', 'bloqueadoHasta'] }]
                })
                res.json(tramitador)
            
        } catch (error) {
            console.log(error);
            res.status(500).json({error:'Hubo un error'})
            
        }
    }

    // Solo los campos del formulario (no se acepta cualquier dato del cuerpo)
    static datosTramitador = (body: any) => ({
        nombreTramitador: body.nombreTramitador,
        identificacion: body.identificacion,
        correoTramitador: body.correoTramitador,
        numeroTramitador: body.numeroTramitador,
        region: body.region,
        ...(body.activo !== undefined && { activo: body.activo }),
        ...(body.esMensajero !== undefined && { esMensajero: body.esMensajero }),
        ...(body.sedeId !== undefined && { sedeId: body.sedeId || null })
    })

    static create =async(req:Request,  res: Response)=>{
        try {
            if (await Tramitador.findOne({ where: { identificacion: req.body.identificacion } })) {
                return res.status(409).json({ error: `Ya existe un tramitador con la identificación ${req.body.identificacion}` })
            }

            const tramitador = await Tramitador.create(TramitadorController.datosTramitador(req.body))
            res.status(201).json({ id: tramitador.id })
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'No se pudo crear el tramitador' })
        }
    }

   static search = async (req: Request, res: Response) => {
  try {
    const search = req.query.search?.toString().trim() || ''
    const limit = Number(req.query.limit) || 20

    if (search.length < 2) {
      return res.json([])
    }

    const tramitadores = await Tramitador.findAll({
      where: {
        activo: true,   // ✅ filtro booleano correcto
        nombreTramitador: {
          [Op.iLike]: `%${search}%`
        }
      },
      order: [
        // Primero los que empiezan por el texto buscado (escapado para evitar inyección SQL)
        [Sequelize.literal(`"nombreTramitador" ILIKE ${db.escape(`${search}%`)}`), 'DESC'],
        ['nombreTramitador', 'ASC']
      ],
      limit
    })

    res.json(tramitadores)

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error buscando tramitadores' })
  }
}


    static getById= async (req:Request,res:Response)=>{
        
         res.json(req.tramitador)

    
    }
     static updateById= async (req:Request,res:Response)=>{
        try {
            const repetido = await Tramitador.findOne({
                where: { identificacion: req.body.identificacion, id: { [Op.ne]: req.tramitador.id } }
            })
            if (repetido) {
                return res.status(409).json({ error: `Ya existe otro tramitador con la identificación ${req.body.identificacion}` })
            }

            await req.tramitador.update(TramitadorController.datosTramitador(req.body))
            res.json('Tramitador actualizado')
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'No se pudo actualizar el tramitador' })
        }
    }
    
    // POST /:tramitadorId/acceso → crea el acceso a la app o restablece la contraseña.
    // La contraseña temporal se devuelve solo en esta respuesta
    static crearAcceso = async (req: Request, res: Response) => {
        try {
            res.json(await crearORestablecerAcceso(req.tramitador, req.usuario.id))
        } catch (error) {
            responderError(res, error)
        }
    }

    // DELETE /:tramitadorId/acceso → quita el acceso a la app
    static revocarAcceso = async (req: Request, res: Response) => {
        try {
            await revocarAcceso(req.tramitador.id)
            res.json('Acceso a la app retirado')
        } catch (error) {
            responderError(res, error)
        }
    }

     // Eliminar borraría en cascada sus trámites: si tiene trámites, se bloquea (desactívelo)
     static deleteById= async (req:Request,res:Response)=>{
        try {
            const tramites = await SolicitudTramites.count({ where: { tramitadorId: req.tramitador.id } })
            if (tramites > 0) {
                return res.status(409).json({ error: `El tramitador tiene ${tramites} trámite(s); desactívelo en lugar de eliminarlo` })
            }

            await req.tramitador.destroy()
            res.json('Tramitador eliminado')
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'No se pudo eliminar el tramitador' })
        }
    }
}

