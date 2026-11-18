import type {Request,Response} from 'express'
import Tramite from '../models/tramite'

declare global{
    namespace Express{
        interface Request{
            tramite?:Tramite       
        }
    }
}

export class TramiteController{
    static getAll =async (req:Request,res:Response) =>{
        try {
                const tramites=  await Tramite.findAll({
                    order:[
                        ['nombreTramite','ASC']
                    ],
                    attributes:["id","nombreTramite","responsable","activo"]
                    

                })
                res.json(tramites)
            
        } catch (error) {
            console.log(error);
            res.status(500).json({error:'Hubo un error'})
            
        }
    }

    static create =async(req:Request,  res: Response)=>{
        try {
                const tramites= new Tramite(req.body)
                await tramites.save()
                res.status(201).json("Dato ingresado correctamente")
        } catch (error) {
              console.log(error);
            //res.status(500).json({error:'No se puede guardar el registro'})
            
        }
    }
    static getById= async (req:Request,res:Response)=>{
        
         res.json(req.tramite)

    
    }
     static updateById= async (req:Request,res:Response)=>{
        await req.tramite.update(req.body)
        res.json('Tramite Actualizado')
    
    }
    
     static deleteById= async (req:Request,res:Response)=>{
           await req.tramite.destroy()
            res.json('Trámite Eliminado')
    
    }
}

