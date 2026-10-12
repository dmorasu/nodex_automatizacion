import type { Request,Response } from "express"

import Usuarios from "../models/usuarios";
import { checkContrasena, correoIgual, hashcontrasena } from "../utils/auth";
import { generateJWT } from "../utils/jwt";
import { ipCliente, minutosBloqueo, registrarExito, registrarFallo } from "../utils/intentosLogin";

let rellenoPromesa: Promise<string> | null = null
const hashDeRelleno = () => (rellenoPromesa ??= hashcontrasena('relleno-para-igualar-tiempos'))




export class AuthController{
    // Sin registro público (2026-10-11): los usuarios los crea el administrador en Administración.
    // Mismo mensaje si el correo no existe o la contraseña no coincide, para no revelar qué
    // correos son usuarios, y límite de intentos por cuenta y por IP (utils/intentosLogin.ts).
    static login =async (req: Request, res:Response) =>{
        const {correoUsuario,contrasena}=req.body
        const ip = ipCliente(req)

        const minutos = minutosBloqueo(correoUsuario, ip)
        if (minutos > 0) {
            return res.status(429).json({error:`Demasiados intentos fallidos. Intente de nuevo en ${minutos} minuto(s)`})
        }

        // El correo se compara sin importar mayúsculas/minúsculas
        const usuario= await Usuarios.findOne({where: correoIgual(correoUsuario)})
        // Si el correo no existe se compara igual contra un hash de relleno: así la respuesta
        // tarda lo mismo y no delata si el correo está registrado
        const contrasenaCorrecta= await checkContrasena(contrasena, usuario?.contrasena ?? await hashDeRelleno())
        if(!usuario || !contrasenaCorrecta){
            registrarFallo(correoUsuario, ip)
            return res.status(401).json({error:'Correo o contraseña incorrectos'})
        }

        registrarExito(correoUsuario)
        res.json(generateJWT(usuario.id))
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