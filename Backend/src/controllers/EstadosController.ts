import type { Request,Response } from "express";
import Estados from "../models/estados";


declare global{
    namespace Express{
        interface Request{
            estados?:Estados    
        }
    }
}

export class EstadosController{
    static getAll= async (req:Request,res:Response)=>{
        try {
            
            const estados=await Estados.findAll({ 
                order:[
                    ['createdAt','DESC']
                ],
                // TODO:Filtrar por estados autenticado
            })
            res.json(estados)
        
        } catch (error) {
            //console.log(error);
            res.status(500).json({error:'Hubo un error'})
        }
    
    }

    static create= async (req:Request,res:Response)=>{
        try {
            const estados=new Estados(req.body)
            await estados.save()
            res.status(201).json("Dato ingresado correctamente")
        } catch (error) {
            console.log(error);
            //res.status(500).json({error:'No se puede guardar el registro'})

            
            
        }
    
    }

    static getById = async (req: Request, res: Response) => {
    try {

        if (!req.estados) {
            return res.status(404).json({
                error: "Estado no encontrado"
            })
        }

        return res.json([req.estados])

    } catch (error) {

        console.error(error)

        return res.status(500).json({
            error: "Hubo un error"
        })

    }
}
     static updateById= async (req:Request,res:Response)=>{
        await req.estados.update(req.body)
        res.json('Registro Actualizado')
    
    }
    
     static deleteById= async (req:Request,res:Response)=>{
           await req.estados.destroy()
            res.json('Estado Eliminado')
    
    }
    
}
