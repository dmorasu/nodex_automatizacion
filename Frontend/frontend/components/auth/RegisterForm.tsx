"use client"

import { registrarUsuario } from "@/actions/crear-cuenta"
import { useEffect, useRef, useState } from "react"
import RequisitosContrasena from "./RequisitosContrasena"

import { useFormState } from "react-dom"
import { toast } from "react-toastify"

export default function RegisterForm() {
  const ref =useRef<HTMLFormElement>(null)
  // Para mostrar los requisitos de la contraseña mientras se escribe
  const [contrasena, setContrasena] = useState("")
  const [state,dispatch]=useFormState(registrarUsuario,{
    errors:[],
    success:''
  })

  useEffect(()=>{
    if(state.success){
        ref.current?.reset()
        setContrasena("")
    }

  },[state])


  useEffect(()=>{
    if(state.errors){
       state.errors.forEach(error =>{
            toast.error(error)
       })
    }
    if(state.success){
            toast.success(state.success)
    }

  },[state])

  
  return (
    <div>
      <form
            ref={ref}
            className="mt-14 space-y-5"
            noValidate
            action={dispatch}

>   

   
    <div className="flex flex-col gap-2">
        <label
            className="font-bold text-2xl"
            htmlFor="correo"
        >Correo</label>
        <input
            id="correoUsuario"
            type="email"
            placeholder="Correo Electronico"
            className="w-full border border-gray-300 p-3 rounded-lg"
            name="correoUsuario"
        />
    </div>

    <div className="flex flex-col gap-2">
        <label
            className="font-bold text-2xl"
        >Nombre</label>
        <input
            type="name"
            placeholder="Nombre de Usuario"
            className="w-full border border-gray-300 p-3 rounded-lg"
            name="nombreUsuario"
        />
    </div>

    <div className="flex flex-col gap-2">
        <label
            className="font-bold text-2xl"
        >Contraseña</label>
        <input
            type="password"
            placeholder="Contraseña"
            className="w-full border border-gray-300 p-3 rounded-lg"
            name="contrasena"
            autoComplete="new-password"
            onChange={e => setContrasena(e.target.value)}
        />
        <RequisitosContrasena contrasena={contrasena} />
    </div>

    <div className="flex flex-col gap-2">
        <label
            className="font-bold text-2xl"
        >Repetir Contraseña</label>
        <input
            id="confirmacion_contrasena"
            type="password"
            placeholder="Repite Contraseña"
            className="w-full border border-gray-300 p-3 rounded-lg"
            name="confirmacion_contrasena"
        />
    </div>

    <input
        type="submit"
        value='Registrarme'
        className="bg-blue-600 hover:bg-blue-700 w-full p-3 rounded-lg text-white font-black  text-xl cursor-pointer block"
    />
</form>
    </div>
  )
}
