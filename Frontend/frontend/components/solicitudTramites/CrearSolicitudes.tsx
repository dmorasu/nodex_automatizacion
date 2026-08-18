"use client"

import { useEffect } from "react"
import { useFormState } from "react-dom"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"

import { crearSolicitud } from "@/actions/crear-Solicitud-action"

import { Usuario } from "@/src/schemas"

import SolicitudTramitesForm
  from "./SolicitudTramitesForm"

import {
  FilePlus2
} from "lucide-react"


export default function CrearSolicitudesForm({
  usuario
}: {
  usuario?: Usuario
}) {

  const router = useRouter()


  // =====================================================
  // FORM STATE
  // =====================================================

  const [state, dispatch] =
    useFormState(
      crearSolicitud,
      {
        errors: [],
        success: "",
        solicitudId: undefined
      }
    )


  // =====================================================
  // RESPUESTAS
  // =====================================================

  useEffect(() => {

    // ===================================================
    // ERRORES
    // ===================================================

    if (state.errors?.length > 0) {

      state.errors.forEach(
        error => {

          toast.error(error)

        }
      )

    }


    // ===================================================
    // SOLICITUD CREADA
    // ===================================================

    if (state.success) {

      toast.success(
        state.success,
        {
          autoClose: 1200,

          // =============================================
          // CUANDO SE CIERRA EL TOAST
          // =============================================

          onClose: () => {

            if (state.solicitudId) {

              router.push(
                `/center/solicitudTramites/${state.solicitudId}`
              )

            } else {

              router.push(
                "/center/dashboard"
              )

            }

            router.refresh()

          },

          // =============================================
          // SI EL USUARIO HACE CLICK EN EL TOAST
          // =============================================

          onClick: () => {

            if (state.solicitudId) {

              router.push(
                `/center/solicitudTramites/${state.solicitudId}`
              )

            } else {

              router.push(
                "/center/dashboard"
              )

            }

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
      {/* INFORMACIÓN DE LA SOLICITUD                       */}
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

            <FilePlus2
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

              Información de la solicitud

            </p>


            <p className="
              mt-0.5
              text-xs
              text-slate-400
            ">

              Complete la información requerida para crear el trámite.

            </p>

          </div>

        </div>


        {/* ================================================= */}
        {/* FORMULARIO                                       */}
        {/* ================================================= */}

        <SolicitudTramitesForm />

      </div>



      {/* ================================================= */}
      {/* USUARIO                                          */}
      {/* ================================================= */}

      <input
        type="hidden"
        id="usuarioId"
        name="usuarioId"
        defaultValue={usuario?.id}
      />



      {/* ================================================= */}
      {/* CREAR SOLICITUD                                   */}
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
          bg-sky-50
          text-sky-600
          text-xs
          font-semibold
          border
          border-sky-200
          transition-all
          duration-200
          hover:bg-sky-500
          hover:text-white
          hover:border-sky-500
          active:scale-[0.99]
          focus:outline-none
          focus:ring-2
          focus:ring-sky-100
        "
      >

        <FilePlus2
          size={15}
        />

        Crear Solicitud

      </button>

    </form>

  )

}