import { DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { useFormState } from "react-dom";
import { useParams } from "next/navigation";
import ErrorMessage from "../ui/ErrorMessage";
import { useEffect } from "react";
import { toast } from "react-toastify";

import CrearProgramacion from "@/actions/crear-Programacion-action";
import { toDateInput } from '@/src/ultis';
import { ProgramacionType } from "@/src/type/solicitudes";

export default function AddProgramacionForm({
  closeModal,
  programacion
}: {
  closeModal: () => void,
  programacion?: ProgramacionType | null
}) {

  const { id } = useParams();

  const [requiereCita, setRequiereCita] = useState(
    programacion?.requiereCita ?? false
  );

  const crearProgramacionId = CrearProgramacion.bind(null, +id);

  const [state, dispatch] = useFormState(crearProgramacionId, {
    errors: [],
    success: ""
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      closeModal();
    }
  }, [state]);

  return (
    <>
      <DialogTitle
        as="h3"
        className="font-black text-4xl text-sky-400 my-5"
      >
        Programación
      </DialogTitle>

      <p className="text-xl font-bold">
        <span className="text-sky-400">Trámite</span>
      </p>

      {state.errors.map(error => (
        <ErrorMessage key={error}>
          {error}
        </ErrorMessage>
      ))}

      <form
        className="b shadow-lg rounded-lg p-10 mt-10 border"
        noValidate
        action={dispatch}
      >

        <div className="py-3">
          <label className="text-sm uppercase font-bold">
            Fecha en que se realizará el trámite:
          </label>

          <input
            type="date"
            name="fechaProbableEntrega"
            className="w-full p-3 border border-gray-100 bg-slate-100"
            defaultValue={toDateInput(
              programacion?.fechaProbableEntrega ?? ""
            )}
          />
        </div>

        <div className="mb-3">
          <label className="text-sm uppercase font-bold">
            Valor del Trámite
          </label>

          <input
            type="number"
            step={0.01}
            min={0}
            name="valorTramite"
            className="w-full p-3 border border-gray-100 bg-slate-100"
            defaultValue={
              programacion?.valorTramite
                ? parseInt(programacion.valorTramite)
                : ""
            }
          />
        </div>

        <div className="mb-3">
          <label className="text-sm uppercase font-bold">
            Concepto de Honorarios
          </label>

          <input
            type="text"
            name="conceptoHonorarios"
            className="w-full p-3 border border-gray-100 bg-slate-100"
            defaultValue={programacion?.conceptoHonorarios ?? ""}
          />
        </div>

        <div className="mb-3">
          <label className="text-sm uppercase font-bold">
            Valor de los Viáticos
          </label>

          <input
            type="number"
            step={0.01}
            min={0}
            name="valorViaticos"
            className="w-full p-3 border border-gray-100 bg-slate-100"
            defaultValue={programacion?.valorViaticos ?? ""}
          />
        </div>

        <div className="mb-3">
          <label className="text-sm uppercase font-bold">
            Concepto de Viáticos
          </label>

          <input
            type="text"
            name="conceptoViaticos"
            className="w-full p-3 border border-gray-100 bg-slate-100"
            defaultValue={programacion?.conceptoViaticos ?? ""}
          />
        </div>

        {/* REQUIERE CITA */}

        <div className="mb-5 border rounded-lg p-4 bg-slate-50">
          <label className="flex items-center gap-3 font-bold">
            <input
              type="checkbox"
              checked={requiereCita}
              onChange={(e) =>
                setRequiereCita(e.target.checked)
              }
            />

            Requiere Cita
          </label>

          <input
            type="hidden"
            name="requiereCita"
            value={requiereCita ? "true" : "false"}
          />
        </div>

        {requiereCita && (
          <>
            <div className="mb-3">
              <label className="text-sm uppercase font-bold">
                Fecha de la Cita
              </label>

              <input
                type="date"
                name="fechaCita"
                className="w-full p-3 border border-gray-100 bg-slate-100"
                defaultValue={
                  programacion?.fechaCita
                    ? toDateInput(programacion.fechaCita)
                    : ""
                }
              />
            </div>

            <div className="mb-5">
              <label className="text-sm uppercase font-bold">
                Hora de la Cita
              </label>

              <input
                type="time"
                name="horaCita"
                className="w-full p-3 border border-gray-100 bg-slate-100"
                defaultValue={
                  programacion?.horaCita ?? ""
                }
              />
            </div>
          </>
        )}

        <input
          type="submit"
          className="bg-sky-400 w-full p-3 text-white uppercase font-bold hover:bg-amber-600 cursor-pointer transition-colors"
          value="Agregar"
        />

      </form>
    </>
  );
}