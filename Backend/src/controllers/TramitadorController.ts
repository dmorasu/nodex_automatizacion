import type {Request,Response} from 'express'
import Tramitador from '../models/tramitador'
import SolicitudTramites from '../models/solicitudTramites'
import { Op,Sequelize, type Transaction } from 'sequelize'
import Municipios from '../models/municipios'
import CoberturaTramitador from '../models/tramitadores/coberturaTramitador'
import { db } from '../config/db'
import AccesoTramitador from '../models/tramitadores/accesoTramitador'
import { crearORestablecerAcceso, revocarAcceso } from '../services/tramitadores/accesoTramitadores'
import { responderError } from './gastos/utilidades'
import { regionesDeMunicipios } from '../services/regionesMunicipios'
import { residenciaDe } from '../services/residenciaTramitador'
import { ErrorGastos } from '../services/gastos/errores'

declare global{
    namespace Express{
        interface Request{
            tramitador?:Tramitador       
        }
    }
}

export class TramitadorController{
    static regiones = async (_req: Request, res: Response) => {
        try {
            res.json(await regionesDeMunicipios())
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'No se pudieron cargar las regiones' })
        }
    }

    static getAll =async (req:Request,res:Response) =>{
        try {
                const tramitador=  await Tramitador.findAll({
                    order:[
                        ['nombreTramitador','ASC']
                    ],
                    include: [
                        // Estado del acceso a la app (nunca la contraseña)
                        { model: AccesoTramitador, attributes: ['debeCambiarContrasena', 'ultimoIngreso', 'bloqueadoHasta'] },
                        // Directorio: municipio de residencia y municipios que cubre
                        { model: Municipios, as: 'municipioResidencia', attributes: ['id', 'nombreMunicipio', 'departamento', 'regional'] },
                        { model: CoberturaTramitador, attributes: ['municipioId'], include: [{ model: Municipios, attributes: ['id', 'nombreMunicipio', 'departamento'] }] }
                    ]
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
        ...(body.sedeId !== undefined && { sedeId: body.sedeId || null }),
        // Datos de la cuenta de cobro (vacío = sin dato)
        ...Object.fromEntries(['direccion', 'ciudad', 'banco', 'tipoCuenta', 'numeroCuenta']
            .filter(campo => body[campo] !== undefined)
            .map(campo => [campo, String(body[campo] ?? '').trim() || null])),
        ...(body.declaracionArt383 !== undefined && { declaracionArt383: body.declaracionArt383 }),
        // Directorio de tramitadores
        ...Object.fromEntries(['correoPersonal', 'tiempoPago', 'notaDirectorio']
            .filter(campo => body[campo] !== undefined)
            .map(campo => [campo, String(body[campo] ?? '').trim() || null])),
        ...Object.fromEntries(['municipioResidenciaId', 'cumpleDia', 'cumpleMes']
            .filter(campo => body[campo] !== undefined)
            .map(campo => [campo, body[campo] || null])),
        ...(body.tarjetaAmparada !== undefined && { tarjetaAmparada: body.tarjetaAmparada })
    })

    // Con municipio de residencia, la región y la ciudad (cuenta de cobro) salen de él; sin él se
    // usan la región y la ciudad que lleguen (tramitadores aún sin residencia). Sin región → 400
    static datosConResidencia = async (body: any) => {
        const datos: Record<string, unknown> = TramitadorController.datosTramitador(body)
        const municipioId = Number(body.municipioResidenciaId) || null
        const residencia = municipioId ? await residenciaDe(municipioId) : null
        if (municipioId && !residencia) throw new ErrorGastos('El municipio de residencia no existe')
        if (residencia) {
            datos.ciudad = residencia.ciudad
            if (residencia.regional) datos.region = residencia.regional
        }
        if (!String(datos.region ?? '').trim()) throw new ErrorGastos(residencia ? 'El municipio de residencia no tiene regional: elija la región' : 'Elija el municipio de residencia')
        return datos
    }

    // Reemplaza los municipios de cobertura (sin el campo en el cuerpo, no se tocan)
    static guardarCobertura = async (tramitadorId: number, municipios: unknown, transaction: Transaction) => {
        if (!Array.isArray(municipios)) return
        const ids = [...new Set(municipios.map(Number).filter(id => Number.isInteger(id) && id > 0))]
        await CoberturaTramitador.destroy({ where: { tramitadorId }, transaction })
        if (ids.length) await CoberturaTramitador.bulkCreate(ids.map(municipioId => ({ tramitadorId, municipioId })), { transaction })
    }

    static create =async(req:Request,  res: Response)=>{
        try {
            if (await Tramitador.findOne({ where: { identificacion: req.body.identificacion } })) {
                return res.status(409).json({ error: `Ya existe un tramitador con la identificación ${req.body.identificacion}` })
            }

            const datos = await TramitadorController.datosConResidencia(req.body)
            const tramitador = await db.transaction(async transaction => {
                const nuevo = await Tramitador.create(datos, { transaction })
                await TramitadorController.guardarCobertura(nuevo.id, req.body.municipiosCobertura, transaction)
                return nuevo
            })
            res.status(201).json({ id: tramitador.id })
        } catch (error) {
            if (error instanceof ErrorGastos) return responderError(res, error)
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

            const datos = await TramitadorController.datosConResidencia(req.body)
            await db.transaction(async transaction => {
                await req.tramitador.update(datos, { transaction })
                await TramitadorController.guardarCobertura(req.tramitador.id, req.body.municipiosCobertura, transaction)
            })
            res.json('Tramitador actualizado')
        } catch (error) {
            if (error instanceof ErrorGastos) return responderError(res, error)
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

