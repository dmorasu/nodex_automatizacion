"use client";

import { DialogTitle } from "@headlessui/react";
import EstadosComboBox from "./EstadosCombobox";
import CrearEstadoTramite from "@/actions/crear-estatoTramite";
import { useFormState } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import ErrorMessage from "../ui/ErrorMessage";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useTiposRechazo } from "@/hooks/useTiposRechazos";

export default function AddExpenseForm({
  closeModal,
}: {
  closeModal: () => void;
}) {
  const router = useRouter();
  const { id } = useParams();

  const [estadoSeleccionado, setEstadoSeleccionado] = useState<number>(0);

  const { data: tiposRechazo } = useTiposRechazo();

  const crearEstadoconId = CrearEstadoTramite.bind(null, +id);

  const [state, dispatch] = useFormState(crearEstadoconId, {
    errors: [],
    success: "",
    requiereEvaluacion: false,
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);

      if (state.requiereEvaluacion) {
        router.replace(`?evaluar=true&showModal=true`);
        return;
      }

      closeModal();
      router.refresh();
    }
  }, [state, closeModal, router]);

  return (
    <>
      <DialogTitle
        as="h3"
        className="font-black text-4xl text-sky-400 my-5"
      >
        Agregar Estado
      </DialogTitle>

      <p className="text-xl font-bold">
        Llena el formulario y registre un{" "}
        <span className="text-sky-400">Estado</span>
      </p>

      {state.errors.map((error) => (
        <ErrorMessage key={error}>{error}</ErrorMessage>
      ))}

      <form
        className="bg-gray-100 shadow-lg rounded-lg p-10 mt-10 border"
        noValidate
        action={dispatch}
      >
        <div className="py-5">
          <EstadosComboBox
            name="estadoId"
            onChange={(id) => setEstadoSeleccionado(id ?? 0)}
          />
        </div>

        {estadoSeleccionado === 3 && (
          <div className="py-5">
            <label className="block text-sm font-bold mb-2">
              Tipo de Subsanación
            </label>

            <select
              name="tipoRechazoId"
              className="w-full border border-gray-300 rounded-md p-3 bg-white"
              required
            >
              <option value="">
                Seleccione un motivo de subsanación
              </option>

              {tiposRechazo?.map((tipo: any) => (
                <option
                  key={tipo.id}
                  value={tipo.id}
                >
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="submit"
          className="bg-sky-400 w-full p-3 text-white uppercase font-bold hover:bg-amber-600 cursor-pointer"
          value="Cambiar Estado"
        />
      </form>
    </>
  );
}