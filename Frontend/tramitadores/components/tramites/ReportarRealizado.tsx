"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CircleCheckBig, Loader2 } from "lucide-react"
import { reportarRealizado } from "@/actions/tramites"
import { claseBotonPrimario, claseBotonSecundario, claseTextarea } from "../ui/estilos"

// Botón "Marcar como realizado": pide una observación y deja el reporte para revisión
export default function ReportarRealizado({ tramiteId }: { tramiteId: number }) {
  const [abierto, setAbierto] = useState(false)
  const [observacion, setObservacion] = useState("")
  const [enviando, startEnviar] = useTransition()

  const enviar = () => {
    if (!observacion.trim()) return toast.error("Cuente qué se hizo en la observación")
    startEnviar(async () => {
      const resultado = await reportarRealizado(tramiteId, observacion)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Listo. El equipo revisará el trámite")
      setAbierto(false)
      setObservacion("")
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={`${claseBotonPrimario} w-full`}>
        <CircleCheckBig size={18} />
        Marcar como realizado
      </button>

      <Dialog open={abierto} onClose={() => !enviando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
        {/* En el celular aparece desde abajo */}
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
          <DialogPanel className="w-full max-w-lg rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <DialogTitle className="text-base font-semibold text-slate-800">Marcar como realizado</DialogTitle>
            <p className="mt-1 text-sm text-slate-500">
              Cuente qué se hizo y cómo quedó. El equipo lo revisará y actualizará el estado del trámite.
            </p>

            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Ej: Se radicó en la Secretaría de Movilidad, radicado 12345. Entregado al cliente."
              className={`${claseTextarea} mt-4`}
              autoFocus
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{observacion.length}/1000</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={enviar} disabled={enviando} className={claseBotonPrimario}>
                {enviando && <Loader2 size={16} className="animate-spin" />}
                Enviar
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
