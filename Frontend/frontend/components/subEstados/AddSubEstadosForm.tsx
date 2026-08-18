"use client"

import { DialogTitle } from "@headlessui/react"
import { useRouter } from "next/navigation"
import { useFormState, useFormStatus } from "react-dom"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { Flag } from "lucide-react"

import CrearSubEstado from "@/actions/crear-subEstado"

import ErrorMessage from "../ui/ErrorMessage"
import SubEstadosCombobox from "./SubEstadosCombobox"


// =====================================================
// BOTÓN GUARDAR
// =====================================================

function SubmitButton() {

  const { pending } = useFormStatus()

  return (

    <div className="
      flex
      justify-end
      pt-2
    ">

      <button
        type="submit"
        disabled={pending}
        className="
          inline-flex
          items-center
          justify-center
          h-9
          min-w-[120px]
          px-4
          rounded-md
          bg-violet-500
          text-white
          text-xs
          font-medium
          transition-all
          hover:bg-violet-600
          focus:outline-none
          focus:ring-2
          focus:ring-violet-200
          disabled:bg-slate-300
          disabled:text-slate-500
          disabled:cursor-not-allowed
        "
      >

        {pending
          ? "Guardando..."
          : "Guardar"
        }

      </button>

    </div>

  )
}


// =====================================================
// FORMULARIO
// =====================================================

export default function AddSubEstadoForm({
  closeModal,
  tramiteId,
  solicitudTramiteId
}: {
  closeModal: () => void
  tramiteId: number
  solicitudTramiteId: number
}) {

  const router = useRouter()


  // =====================================================
  // ACTION
  // =====================================================

  const action =
    CrearSubEstado.bind(
      null,
      solicitudTramiteId
    )


  const [state, dispatch] =
    useFormState(action, {
      errors: [],
      success: ''
    })


  // =====================================================
  // RESPUESTA
  // =====================================================

  useEffect(() => {

    if (state.success) {

      toast.success(state.success)

      closeModal()

      router.refresh()

    }

  }, [state, closeModal, router])


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
          bg-violet-50
          border
          border-violet-100
          shrink-0
        ">

          <Flag
            size={18}
            className="text-violet-500"
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
            Agregar SubEstado
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Seleccione el subestado que desea asociar al trámite.
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
        action={dispatch}
        className="
          space-y-5
        "
      >


        {/* =============================================== */}
        {/* SUBESTADO                                       */}
        {/* =============================================== */}

        <div>

          <label className="
            block
            mb-1.5
            text-xs
            font-medium
            text-slate-600
          ">
            SubEstado
          </label>


          <SubEstadosCombobox
            tramiteId={tramiteId}
          />

        </div>



        {/* =============================================== */}
        {/* BOTÓN                                           */}
        {/* =============================================== */}

        <SubmitButton />


      </form>

    </>
  )
}