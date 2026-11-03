"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, Search, UserCheck, X } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import { fechaCorta, type TramiteSinMensajero } from "@/src/agenda"
import { claseInput } from "@/components/ui/estilos"

// Trámites abiertos sin tramitador (Torre de control). "Asignar" abre el espacio con el trámite
// elegido para escoger mensajero y horario.
export default function BandejaSinMensajero({ onAsignar, onCerrar }: {
  onAsignar: (tramite: TramiteSinMensajero) => void
  onCerrar: () => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [tramites, setTramites] = useState<TramiteSinMensajero[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Busca en el servidor al dejar de escribir
  useEffect(() => {
    let vigente = true
    const espera = setTimeout(async () => {
      const r = await llamarApi<TramiteSinMensajero[]>(`/agenda-mensajeros/sin-mensajero?q=${encodeURIComponent(busqueda.trim())}`)
      if (!vigente) return
      if (r.ok) { setTramites(r.datos); setError(null) } else setError(r.error)
    }, 300)
    return () => { vigente = false; clearTimeout(espera) }
  }, [busqueda])

  return (
    <Dialog open onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">Trámites sin mensajero</DialogTitle>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="border-b border-slate-100 px-6 py-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Número, placa, trámite, municipio o dirección" className={`${claseInput} pl-8`} aria-label="Buscar" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {error ? (
              <p className="px-6 py-6 text-xs text-red-600">{error}</p>
            ) : !tramites ? (
              <p className="flex items-center gap-2 px-6 py-6 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
            ) : tramites.length === 0 ? (
              <p className="px-6 py-6 text-xs text-slate-400">No hay trámites sin mensajero.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tramites.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">
                        #{t.id} · {t.tramite ?? "Trámite"}
                        {t.requiereCita && <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Requiere cita</span>}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {[t.placa, t.cliente, [t.direccion, t.municipio].filter(Boolean).join(", "), t.estado, t.fechaDiligencia && `Diligencia ${fechaCorta(t.fechaDiligencia)}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button type="button" onClick={() => onAsignar(t)} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                      <UserCheck size={14} /> Asignar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
