"use client"

import { DialogTitle } from "@headlessui/react"
import TramitadorComboBox from "./TramitadorCombobox"
import { useFormState } from "react-dom"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { User } from "lucide-react"

import ErrorMessage from "../ui/ErrorMessage"

import AsignarTramitadorSolicitud from "@/actions/asignar-Tramitador-action"
import { TramitadorType } from "@/src/type/solicitudes"


export default function AddTramitadorForm({
  closeModal,
  tramitador
}: {
  closeModal: () => void
  tramitador?: TramitadorType | null
}) {

  const { id } = useParams()


  // =====================================================
  // ACTION
  // =====================================================

  const asignarTramitadorConId =
    AsignarTramitadorSolicitud.bind(
      null,
      Number(id)
    )


  const [state, dispatch] =
    useFormState(
      asignarTramitadorConId,
      {
        errors: [],
        success: ""
      }
    )


  // =====================================================
  // RESPUESTA
  // =====================================================

  useEffect(() => {

    if (state.success) {

      toast.success(state.success)

      closeModal()

    }

  }, [state, closeModal])


  return (
    <>

      {/* ================================================= */}
      {/* ENCABEZADO                                       */}
      {/* ================================================= */}

      <div className="
        flex
        items-center
        gap-3
        mb-6
      ">


        {/* ICONO */}

        <div className="
          flex
          items-center
          justify-center
          w-9
          h-9
          rounded-lg
          bg-sky-50
          border
          border-sky-100
          shrink-0
        ">

          <User
            size={18}
            className="text-sky-500"
          />

        </div>


        {/* TÍTULO */}

        <div>

          <DialogTitle
            as="h3"
            className="
              text-lg
              font-semibold
              text-slate-800
              leading-tight
            "
          >
            Asignar Tramitador
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Seleccione el tramitador responsable de gestionar la solicitud.
          </p>

        </div>

      </div>



      {/* ================================================= */}
      {/* ERRORES                                           */}
      {/* ================================================= */}

      {state.errors.map(error => (

        <ErrorMessage
          key={error}
        >
          {error}
        </ErrorMessage>

      ))}



      {/* ================================================= */}
      {/* FORMULARIO                                        */}
      {/* ================================================= */}

      <form
        className="
          space-y-5
        "
        noValidate
        action={dispatch}
      >


        {/* =============================================== */}
        {/* TRAMITADOR                                      */}
        {/* =============================================== */}

        <div>

          <label className="
            block
            mb-1.5
            text-xs
            font-medium
            text-slate-600
          ">
            Tramitador
          </label>


          <TramitadorComboBox
            name="tramitadorId"
            defaultValue={
              tramitador?.id
            }
            defaultLabel={
              tramitador?.nombreTramitador
            }
          />

        </div>



        {/* ================================================= */}
        {/* BOTÓN                                             */}
        {/* ================================================= */}

        <div className="
          flex
          justify-end
          pt-2
        ">

          <button
            type="submit"
            className="
              inline-flex
              items-center
              justify-center
              h-9
              min-w-[150px]
              px-4
              rounded-md
              bg-sky-500
              text-white
              text-xs
              font-medium
              transition-all
              hover:bg-sky-600
              focus:outline-none
              focus:ring-2
              focus:ring-sky-200
              cursor-pointer
            "
          >
            Asignar Tramitador
          </button>

        </div>


      </form>

    </>
  )
}