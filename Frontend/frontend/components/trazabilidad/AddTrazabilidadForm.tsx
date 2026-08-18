"use client"

import { DialogTitle } from "@headlessui/react"
import { useFormState } from "react-dom"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { Activity } from "lucide-react"

import ErrorMessage from "../ui/ErrorMessage"
import CrearTrazabilidad from "@/actions/crear-Trazabilidad"


export default function AddTrazabilidadForm({
  closeModal
}: {
  closeModal: () => void
}) {

  const { id } = useParams()


  // =====================================================
  // ACTION
  // =====================================================

  const crearTrazabilidadconId =
    CrearTrazabilidad.bind(
      null,
      +id
    )


  const [state, dispatch] =
    useFormState(
      crearTrazabilidadconId,
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

          <Activity
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
            Trazabilidad de la Solicitud
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Registre y consulte las actualizaciones y novedades asociadas al trámite.
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
        {/* OBSERVACIÓN                                     */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="observacionTrazabilidad"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Observación
          </label>


          <textarea
            id="observacionTrazabilidad"
            name="observacionTrazabilidad"
            rows={5}
            placeholder="Detalle de la observación..."
            className="
              w-full
              px-3
              py-2.5
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              placeholder:text-slate-400
              outline-none
              resize-y
              transition
              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "
          />

          <p className="
            mt-1.5
            text-[11px]
            text-slate-400
          ">
            Registre la información relevante sobre la actualización del trámite.
          </p>

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
              min-w-[120px]
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
            Agregar
          </button>

        </div>


      </form>

    </>
  )
}