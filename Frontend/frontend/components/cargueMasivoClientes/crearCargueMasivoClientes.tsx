"use client"


import { useActionState, useEffect } from "react"
import { crearCliente } from "@/actions/crear-Cliente-action"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"
import CargaMasivaClientes from "./cargaMasivaClientesForm"
import { conservarCampos } from "@/src/lib/formularios"




export default function CrearClientesMasivosForm() {
  const router =useRouter()
  const[state,dispatch] =useActionState(crearCliente,{
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
      onReset={conservarCampos}
    >
       

      <CargaMasivaClientes/>

      <input
        type="submit"
        className="bg-blue-500 w-full p-3 text-white uppercase font-bold hover:bg-amber-600 cursor-pointer transition-colors"
        value='Cargar Masivo'
      />
    </form>
  )
}