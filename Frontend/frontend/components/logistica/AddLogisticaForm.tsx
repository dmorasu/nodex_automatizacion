"use client";

import { DialogTitle } from "@headlessui/react";
import { useFormState } from "react-dom";
import { useParams } from "next/navigation";
import ErrorMessage from "../ui/ErrorMessage";
import { useEffect } from "react";
import { toast } from "react-toastify";

import { Truck } from "lucide-react";

import CrearLogistica from "@/actions/crear-logistica-action";
import { LogisticaType } from "@/src/type/solicitudes";
import { toDateInput } from "@/src/ultis";
import TransportadorasSelect from "../transportadoras/transportadoraSelect";


export default function AddLogisticaForm({
  closeModal,
  logistica
}: {
  closeModal: () => void;
  logistica?: LogisticaType | null;
}) {

  const { id } = useParams();


  // =====================================================
  // ACTION
  // =====================================================

  const crearLogisticaconId =
    CrearLogistica.bind(null, +id);


  const [state, dispatch] =
    useFormState(crearLogisticaconId, {
      errors: [],
      success: ""
    });


  // =====================================================
  // RESPUESTA
  // =====================================================

  useEffect(() => {

    if (state.success) {

      toast.success(state.success);

      closeModal();

    }

  }, [state, closeModal]);


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

          <Truck
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
            Programación Logística
          </DialogTitle>


          <p className="
            mt-1
            text-xs
            text-slate-400
          ">
            Registre y gestione la información relacionada con el envío.
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
        {/* NÚMERO DE GUÍA                                  */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="numeroGuia"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Número de Guía
          </label>


          <input
            id="numeroGuia"
            type="text"
            name="numeroGuia"
            placeholder="Ingrese número de guía"
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
            defaultValue={
              logistica?.numeroGuia ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* VALOR DEL ENVÍO                                 */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="valorEnvio"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Valor del Envío
          </label>


          <input
            id="valorEnvio"
            type="number"
            name="valorEnvio"
            placeholder="Valor del envío"
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
            defaultValue={
              logistica?.valorEnvio ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* TRANSPORTADORA                                  */}
        {/* =============================================== */}

        <div>

          <label
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Transportadora
          </label>


          <TransportadorasSelect
            name="transportadoraId"
            defaultValue={
              logistica?.transportadoraId ?? undefined
            }
          />

        </div>



        {/* =============================================== */}
        {/* DESTINATARIO                                    */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="destinatario"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Destinatario
          </label>


          <input
            id="destinatario"
            type="text"
            name="destinatario"
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
            defaultValue={
              logistica?.destinatario ?? ""
            }
          />

        </div>



        {/* =============================================== */}
        {/* FECHA PROBABLE DE ENTREGA                       */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="fechaProgramacionLogistica"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Fecha Probable de Entrega
          </label>


          <input
            id="fechaProgramacionLogistica"
            type="date"
            name="fechaProgramacionLogistica"
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
            defaultValue={toDateInput(
              logistica?.fechaProgramacionLogistica ?? ""
            )}
          />

        </div>



        {/* =============================================== */}
        {/* FECHA ENTREGA TRANSPORTADORA                   */}
        {/* =============================================== */}

        <div>

          <label
            htmlFor="fechaEntregaTransportadora"
            className="
              block
              mb-1.5
              text-xs
              font-medium
              text-slate-600
            "
          >
            Fecha de Entrega Transportadora
          </label>


          <input
            id="fechaEntregaTransportadora"
            type="date"
            name="fechaEntregaTransportadora"
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
            defaultValue={toDateInput(
              logistica?.fechaEntregaTransportadora ?? ""
            )}
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
  );
}