"use client"

import {
  SolicitudTramites,
  Usuario
} from "@/src/schemas"

import SolicitudTramitesForm
  from "./SolicitudTramitesForm"

import { useFormState }
  from "react-dom"

import {
  EditarSolicitudTramite
} from "@/actions/editar-Solicitud-action"

import ErrorMessage
  from "../ui/ErrorMessage"

import {
  useEffect
} from "react"

import {
  toast
} from "react-toastify"

import {
  useRouter
} from "next/navigation"

import {
  Save,
  Loader2
} from "lucide-react"

import {
  useFormStatus
} from "react-dom"


type Props = {
  solicitud: SolicitudTramites
  usuario?: Usuario
}


/* ===================================================== */
/* BOTÓN GUARDAR                                         */
/* ===================================================== */

function GuardarButton() {

  const { pending } =
    useFormStatus()


  return (

    <button
      type="submit"
      disabled={pending}
      className="
        w-full
        h-10

        flex
        items-center
        justify-center
        gap-2

        rounded-md

        bg-sky-500
        text-white

        text-xs
        font-medium

        transition

        hover:bg-sky-600

        focus:outline-none
        focus:ring-2
        focus:ring-sky-200

        disabled:bg-slate-300
        disabled:cursor-not-allowed
      "
    >

      {pending ? (

        <>

          <Loader2
            size={14}
            className="
              animate-spin
            "
          />

          Guardando...

        </>

      ) : (

        <>

          <Save
            size={15}
          />

          Guardar cambios

        </>

      )}

    </button>

  )
}



/* ===================================================== */
/* COMPONENTE PRINCIPAL                                  */
/* ===================================================== */

export default function EditarSolicitudTramiteForm({
  solicitud,
  usuario
}: Props) {


  const router =
    useRouter()


  const editarSolicitudTramiteid =
    EditarSolicitudTramite.bind(
      null,
      solicitud.id
    )


  const [state, dispatch] =
    useFormState(
      editarSolicitudTramiteid,
      {
        errors: [],
        success: ""
      }
    )



  // ===================================================
  // RESPUESTA DEL SERVIDOR
  // ===================================================

  useEffect(() => {

    if (state.success) {

      toast.success(
        state.success
      )


      router.push(
        "/center"
      )

      router.refresh()

    }

  }, [
    state,
    router
  ])



  return (

    <form
      className="
        mt-6
        space-y-4
      "
      noValidate
      action={dispatch}
    >


      {/* ============================================= */}
      {/* ERRORES                                       */}
      {/* ============================================= */}

      {state.errors?.length > 0 && (

        <div className="
          space-y-2
        ">

          {state.errors.map(
            (error) => (

              <ErrorMessage
                key={error}
              >
                {error}
              </ErrorMessage>

            )
          )}

        </div>

      )}



      {/* ============================================= */}
      {/* FORMULARIO                                    */}
      {/* ============================================= */}

      <SolicitudTramitesForm
        solicitud={solicitud}
      />



      {/* ============================================= */}
      {/* USUARIO                                       */}
      {/* ============================================= */}

      <input
        type="hidden"
        id="usuarioId"
        name="usuarioId"
        defaultValue={
          usuario?.id
        }
      />



      {/* ============================================= */}
      {/* GUARDAR                                       */}
      {/* ============================================= */}

      <div className="
        pt-3
      ">

        <GuardarButton />

      </div>

    </form>

  )
}