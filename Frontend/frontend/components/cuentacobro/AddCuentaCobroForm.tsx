"use client"

import { DialogTitle } from "@headlessui/react"
import { useFormState } from "react-dom"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "react-toastify"

import { Receipt } from "lucide-react"

import ErrorMessage from "../ui/ErrorMessage"

import CrearCuentaCobro
  from "@/actions/crear-CuentaCobro-action"

import { CuentaCobroType }
  from "@/src/type/solicitudes"

import { toDateInput }
  from "@/src/ultis"


export default function AddCuentaCobroForm({
  closeModal,
  cuentaCobro
}: {
  closeModal: () => void
  cuentaCobro?: CuentaCobroType | null
}) {

  const { id } = useParams()


  // =====================================================
  // SERVER ACTION
  // =====================================================

  const crearCuentaCobroconId =
    CrearCuentaCobro.bind(
      null,
      +id
    )


  const [state, dispatch] =
    useFormState(
      crearCuentaCobroconId,
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

      toast.success(
        state.success
      )

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

          <Receipt
            size={18}
            className="
              text-sky-500
            "
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
            Cuenta de Cobro
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Registre la información correspondiente a la cuenta de cobro del trámite.
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
        {/* NÚMERO CUENTA DE COBRO                          */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="numeroCuentaCobro"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Número de Cuenta de Cobro
          </label>


          <input
            id="numeroCuentaCobro"
            type="text"
            name="numeroCuentaCobro"

            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              placeholder:text-slate-400
              outline-none
              transition

              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "

            placeholder="
              Número de cuenta de cobro
            "

            defaultValue={
              cuentaCobro?.numeroCuentaCobro ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* VALOR                                           */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="valorCuentaCobro"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Valor de la Cuenta de Cobro
          </label>


          <input
            id="valorCuentaCobro"
            type="text"
            name="valorCuentaCobro"

            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              placeholder:text-slate-400
              outline-none
              transition

              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "

            placeholder="
              Valor de la cuenta de cobro
            "

            defaultValue={
              cuentaCobro?.valorCuentaCobro ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* FECHA RECIBIDA                                  */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="fechaRecibidaCuentaCobroTramitador"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Fecha Recibida por el Tramitador
          </label>


          <input
            id="fechaRecibidaCuentaCobroTramitador"
            type="date"
            name="fechaRecibidaCuentaCobroTramitador"

            className="
              w-full
              h-10
              px-3
              rounded-md
              border
              border-slate-200
              bg-slate-50
              text-xs
              text-slate-700
              outline-none
              transition

              focus:bg-white
              focus:border-sky-400
              focus:ring-2
              focus:ring-sky-100
            "

            defaultValue={
              toDateInput(
                cuentaCobro?.fechaRecibidaCuentaCobroTramitador ?? ""
              )
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
              gap-2
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

            <Receipt
              size={15}
            />

            Guardar

          </button>

        </div>


      </form>

    </>
  )
}