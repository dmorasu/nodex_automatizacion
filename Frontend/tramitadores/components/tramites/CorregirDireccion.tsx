"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, Pencil } from "lucide-react"
import { corregirDireccion } from "@/actions/tramites"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "../ui/estilos"

// "Corregir dirección" (solo mensajeros): la dirección nueva queda en el trámite y en la ruta,
// y Google la vuelve a ubicar en el mapa
export default function CorregirDireccion({ tramiteId, direccion, municipio }: {
  tramiteId: number
  direccion: string | null
  municipio?: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(direccion ?? "")
  const [enviando, startEnviar] = useTransition()

  const abrir = () => {
    setTexto(direccion ?? "")
    setAbierto(true)
  }

  const guardar = () => {
    if (!texto.trim()) return toast.error("Escriba la dirección")
    startEnviar(async () => {
      const resultado = await corregirDireccion(tramiteId, texto)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success(resultado.mensaje)
      setAbierto(false)
    })
  }

  return (
    <>
      <button type="button" onClick={abrir} className="inline-flex items-center gap-1 py-1 text-xs font-semibold text-indigo-600 active:text-indigo-800">
        <Pencil size={13} /> Corregir dirección
      </button>

      <Dialog open={abierto} onClose={() => !enviando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
        {/* En el celular aparece desde abajo */}
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
          <DialogPanel className="w-full max-w-lg rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
            <DialogTitle className="text-base font-semibold text-slate-800">Corregir dirección · Trámite #{tramiteId}</DialogTitle>
            <p className="mt-1 text-sm text-slate-500">
              Escriba la dirección correcta{municipio ? ` en ${municipio}` : ""}. Cambia en el trámite y en la ruta, y queda en el historial.
            </p>

            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              maxLength={100}
              placeholder="Ej: Calle 10 # 43-25, oficina 301"
              className={`${claseInput} mt-4`}
              autoFocus
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{texto.length}/100</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={guardar} disabled={enviando} className={claseBotonPrimario}>
                {enviando && <Loader2 size={16} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
