"use server"
import {cookies, headers} from 'next/headers'
import {redirect} from 'next/navigation'
import { inicioSesionSchema } from "@/src/schemas"
import { mensajesDeError } from "@/src/lib/erroresBackend"


type ActionStateType ={
    errors: string[]
}


export async function autenticacion(prevState:ActionStateType, formData:FormData) {

    const credenciales ={
        correoUsuario: formData.get("correoUsuario"),
        contrasena:formData.get("contrasena")
    }

    

    const  auth= inicioSesionSchema.safeParse(credenciales)
    if(!auth.success){
        return {
            errors:auth.error.issues.map((error)=>error.message)
        }
    }



    const url=`${process.env.API_URL}/auth/login`
    const req =await fetch(url,{
        method:'POST',
        headers:{
            'Content-Type': 'application/json',
            // IP real del navegador (la pone Nginx) para el límite de intentos del backend
            'X-IP-Cliente': (await headers()).get('x-real-ip') ?? '',
        },
        body: JSON.stringify({
            contrasena:auth.data.contrasena,
            correoUsuario:auth.data.correoUsuario
        })
    })


    const json =await req.json().catch(() => null)
    

    if(!req.ok){
        return{
            errors: mensajesDeError(json, "No se pudo iniciar sesión, intente de nuevo")
        }
    }
    
    //Setear Cookies
    const almacen = await cookies()
    almacen.set({
        name:'TOKEN',
        value: json,
        httpOnly:true,
        path:'/',
        // Solo por HTTPS en producción, no se envía desde otros sitios y dura lo mismo que el token
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60

    })
    redirect('/center/dashboard')

    
    
}