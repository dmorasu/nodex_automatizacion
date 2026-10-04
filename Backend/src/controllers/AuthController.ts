import type { Request,Response } from "express"

import Usuarios from "../models/usuarios";
import { checkContrasena, correoIgual, hashcontrasena } from "../utils/auth";
import { generateJWT } from "../utils/jwt";




export class AuthController{
    static createAccount = async (req:Request, res: Response) =>{

        const {correoUsuario}=req.body

        // El correo se compara sin importar mayúsculas/minúsculas
        const usuarioExists= await Usuarios.findOne({where: correoIgual(correoUsuario)})
        if (usuarioExists){
            const error = new Error('El usuario ya existe')
            return res.status(409).json({error:error.message})
        }

        try {
            const usuario = new Usuarios(req.body)
            usuario.contrasena =await hashcontrasena(req.body.contrasena)
            usuario.save()
            res.json("Registro Creado Correctamente")
        } catch (error) {
            //console.log(error);
            res.status(500).json({error:'Ocurrrio un error'})
            
            
        }
    }


    static login =async (req: Request, res:Response) =>{


        const {correoUsuario,contrasena}=req.body

        // El correo se compara sin importar mayúsculas/minúsculas
        const usuarioExists= await Usuarios.findOne({where: correoIgual(correoUsuario)})
        if (!usuarioExists){
            const error = new Error('Usuario no encontrado')
            return res.status(409).json({error:error.message})
        }
        

        const contrasenaCorrecta= await checkContrasena(contrasena,usuarioExists.contrasena)
        if(!contrasenaCorrecta){
            const error = new Error('Contraseña incorrecta')
            return  res.status(401).json({error:error.message})
        }
        const token=generateJWT(usuarioExists.id)

        res.json(token)
        
        

    }


    static usuario =async (req: Request, res:Response) =>{
        res.json(req.usuario)
        
    }

    static updateContrasenaUsuario =async (req: Request, res:Response) =>{
        const {contrasenaActual, contrasena} =req.body
        const {id}=req.usuario
        const usuario = await Usuarios.findByPk(id)
        const contrasenaCorrecta= await checkContrasena(contrasenaActual, usuario.contrasena)
        
        
        
        if(!contrasenaCorrecta){
            const error = new Error('La contrseña  actual es incorrecta')
            return res.status(401).json({error:error.message})
        }

        usuario.contrasena= await hashcontrasena(contrasena)
        await usuario.save()
        res.json(" La contraseña se modifico")





        
    }

}