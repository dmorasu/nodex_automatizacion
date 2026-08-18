"use client"

import { useEffect } from "react"
import { useFormState } from "react-dom"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"

import { crearCliente } from "@/actions/crear-Cliente-action"
import ClientesForm from "./ClientesForm"

import {
  UserPlus,
  Loader2,
} from "lucide-react"


export default function CrearClientesForm() {

  const router = useRouter()

  const [state, dispatch] =
    useFormState(crearCliente, {
      errors: [],
      success: ""
    })


  // =====================================================
  // RESPUESTAS
  // =====================================================

  useEffect(() => {

    if (state.errors) {

      state.errors.forEach(
        error => {
          toast.error(error)
        }
      )

    }


    if (state.success) {

      toast.success(
        state.success,
        {
          autoClose: 1200,

          onClose: () => {
            router.push("/center")
            router.refresh()
          },

          onClick: () => {
            router.push("/center")
            router.refresh()
          }
        }
      )

    }

  }, [state, router])


  return (

    <form
      className="
        w-full
        space-y-5
      "
      noValidate
      action={dispatch}
    >


      {/* ================================================= */}
      {/* INFORMACIÓN                                      */}
      {/* ================================================= */}

      <div className="
        bg-slate-50
        border
        border-slate-200
        rounded-xl
        p-4
      ">

        <div className="
          flex
          items-center
          gap-2
          mb-4
        ">

          <div className="
            flex
            items-center
            justify-center
            w-8
            h-8
            rounded-lg
            bg-white
            border
            border-sky-100
          ">

            <UserPlus
              size={15}
              className="
                text-sky-500
              "
            />

          </div>


          <div>

            <p className="
              text-xs
              font-semibold
              text-slate-700
            ">

              Datos del cliente

            </p>


            <p className="
              mt-0.5
              text-xs
              text-slate-400
            ">

              Complete la información solicitada.

            </p>

          </div>

        </div>


        {/* ================================================= */}
        {/* FORMULARIO                                       */}
        {/* ================================================= */}

        <ClientesForm />

      </div>



      {/* ================================================= */}
      {/* BOTÓN CREAR                                      */}
      {/* ================================================= */}

      <button
  type="submit"
  className="
    w-full
    h-10
    flex
    items-center
    justify-center
    gap-2
    rounded-lg
    bg-sky-500
    text-white
    text-xs
    font-semibold
    border
    border-sky-500
    transition-all
    duration-200
    hover:bg-sky-600
    hover:border-sky-600
    active:scale-[0.99]
    focus:outline-none
    focus:ring-2
    focus:ring-sky-200
  "
>
  <UserPlus size={15} />
  Crear Cliente
</button>

    </form>

  )
} 