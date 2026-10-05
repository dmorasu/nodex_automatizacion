"use client"


import { useActionState, useEffect } from "react"
import { useFormState } from "react-dom"
import { crearCliente } from "@/actions/crear-Cliente-action"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"
import CargueMasivaForm from "./cargueMasivaForm"



export default function CrearClientesForm() {
  const router =useRouter()
  const[state,dispatch] =useFormState(crearCliente,{
    errors:[],
    success:''
  })

  useEffect(()=>{
    if(state.errors){
       state.errors.forEach(error =>{
            toast.error(error)
       })
    }

    if(state.success){
       toast.success(state.success,{
         autoClose:1200,
         onClose:()=>{
            router.push('/center/dashboard')
            router.refresh()
         },
         onClick:()=>{
            router.push('/center/dashboard')
            router.refresh()
         }

       })
    }
    

  },[state])
  


  return (
    <form
      className="mt-10 space-y-3  "
      noValidate
      action={dispatch}
    >
       

      <CargueMasivaForm/>

      <input
        type="submit"
        className="bg-blue-500 w-full p-3 text-white uppercase font-bold hover:bg-amber-600 cursor-pointer transition-colors"
        value='Cargar Masivo'
      />
    </form>
  )
}