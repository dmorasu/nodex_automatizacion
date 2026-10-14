"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CircleCheck, Loader2, X } from "lucide-react"
import { subsanarNovedad } from "@/actions/subsanar-novedad-action"

const claseInput = `
  w-full h-10 px-3 rounded-md border border-slate-200 bg-white
  text-base sm:text-xs text-slate-700 outline-none transition
  focus:border-sky-400 focus:ring-2 focus:ring-sky-100
`
const claseLabel = "block mb-1.5 text-xs font-medium text-slate-600"

const hoyColombia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date())

// Botón + ventana para que quien creó el trámite marque la novedad como subsanada.
// Solo se muestra cuando el trámite está "En espera por novedad" (page.tsx).
export default function SubsanarNovedad({ solicitudTramiteId, novedad }: { solicitudTramiteId: number, novedad: string | null }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState("")
  const [observacion, setObservacion] = useState("")
  const [error, setError] = useState("")
  const [guardando, startGuardar] = useTransition()

  const cerrar = () => {
    if (guardando) return
    setAbierto(false)
    setError("")
  }

  const guardar = () => {
    if (!observacion.trim()) return setError("Escriba qué se subsanó")
    if (!fecha) return setError("Elija la nueva fecha de entrega del resultado")
    if (fecha < hoyColombia()) return setError("La fecha de entrega del resultado no puede ser anterior a hoy")
    setError("")

    startGuardar(async () => {
      const resultado = await subsanarNovedad(solicitudTramiteId, { fechaEntregaResultado: fecha, observacion: observacion.trim() })
      if (!resultado.ok) {
        setError(resultado.error)
        return
      }
      toast.success("Novedad subsanada. Se avisó al analista.")
      setAbierto(false)
      setFecha("")
      setObservacion("")
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-emerald-600 text-white text-xs font-semibold shadow-sm transition hover:bg-emerald-700"
      >
        <CircleCheck size={15} />
        Novedad subsanada
      </button>

      <Dialog open={abierto} onClose={cerrar} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-lg rounded-xl bg-white shadow-xl">

              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <DialogTitle className="text-sm font-semibold text-slate-800">Novedad subsanada · Trámite {solicitudTramiteId}</DialogTitle>
                  {novedad && <p className="mt-0.5 text-xs text-amber-700">{novedad}</p>}
                </div>
                <button type="button" onClick={cerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <label className="block">
                  <span className={claseLabel}>Qué se subsanó <span className="text-red-400">*</span></span>
                  <textarea
                    value={observacion}
                    onChange={e => setObservacion(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-base sm:text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="block">
                  <span className={claseLabel}>Nueva fecha de entrega del resultado <span className="text-red-400">*</span></span>
                  <input type="date" value={fecha} min={hoyColombia()} onChange={e => setFecha(e.target.value)} className={claseInput} />
                </label>

                {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button type="button" onClick={cerrar} disabled={guardando} className="h-10 px-4 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="button" onClick={guardar} disabled={guardando} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {guardando && <Loader2 size={15} className="animate-spin" />}
                  Marcar como subsanada
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  )
}
