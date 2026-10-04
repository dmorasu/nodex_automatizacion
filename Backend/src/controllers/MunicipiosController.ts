import type {Request,Response} from 'express'
import Municipio from '../models/municipios'
import { Op, Sequelize, QueryTypes } from 'sequelize'
import { db } from '../config/db'

declare global{
    namespace Express{
        interface Request{
            municipio?:Municipio
        }
    }
}

export class MunicipioController{
// La tabla Municipios quedó cargada dos veces (una copia sin regional y otra con regional).
// Mientras se unifican (scripts/unificarMunicipios.ts), el buscador muestra cada municipio una
// sola vez: la copia con menor id, que es la que usa la mayoría de trámites.
static search = async (req, res) => {
  try {
    const search = req.query.search?.toString().trim() || '';
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (search.length < 2) return res.json([]);

    const municipios = await db.query(`
      SELECT * FROM (
        SELECT DISTINCT ON (UPPER(TRIM(m."nombreMunicipio")), UPPER(TRIM(m.departamento)))
          m.id, m."nombreMunicipio", m.departamento,
          -- La regional puede estar solo en la otra copia
          COALESCE(m.regional, (
            SELECT d.regional FROM "Municipios" d
            WHERE UPPER(TRIM(d."nombreMunicipio")) = UPPER(TRIM(m."nombreMunicipio"))
              AND UPPER(TRIM(d.departamento)) = UPPER(TRIM(m.departamento))
              AND d.regional IS NOT NULL
            LIMIT 1
          )) AS regional,
          m.responsable, m."analistaId", m.latitud, m.longitud
        FROM "Municipios" m
        WHERE m."nombreMunicipio" ILIKE :contiene
        ORDER BY UPPER(TRIM(m."nombreMunicipio")), UPPER(TRIM(m.departamento)), m.id
      ) unicos
      -- Primero los que empiezan por el texto buscado
      ORDER BY ("nombreMunicipio" ILIKE :empieza) DESC, "nombreMunicipio", departamento
      LIMIT :limit
    `, {
      type: QueryTypes.SELECT,
      replacements: { contiene: `%${search}%`, empieza: `${search}%`, limit }
    });

    res.json(municipios);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error buscando municipios' });
  }
};

    static getAll =async(req:Request, res:Response)=>{
        try {
                const municipio=await Municipio.findAll({
                    order:[
                        ['createdAt','DESC']
                    ],
                })
                res.json(municipio)
        } catch (error) {
            console.log(error);
            res.status(500).json({error:'Error al consultar todos los municipios'})
            
        }
    }

    static create  =async(req:Request,res:Response)=>{
        try {
                const municipio= new Municipio(req.body)
                await municipio.save()
                res.status(201).json('municipio almacenado correctamente')

        } catch (error) {
            res.status(500).json({error:"No se pudo almacenar el municipio"})
            //console.log(error);
            
            
        }
    }

    static getById =  async (req:Request,res:Response)=>{
        res.json(req.municipio)
    }

    static updateById =async (req:Request,res:Response)=>{
        await req.municipio.update(req.body)
        res.json('Municipio Actualizado')
    }

    static deleteById =async(req:Request,res:Response)=>{
        await req.municipio.destroy()
        res.json('Municipio Eliminado')
    }

}