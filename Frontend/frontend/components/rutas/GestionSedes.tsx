"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Building2, Loader2, MapPin, MapPinOff, Pencil, Plus, X } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import type { Sede } from "@/src/rutas"
import ModalUbicacion from "./ModalUbicacion"

const claseInput = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

type Edicion = { id?: number, nombre: string, direccion: string, latitud: number | null, longitud: number | null, activo: boolean }

// Botón + ventana para administrar las sedes de las que salen los mensajeros
export default function GestionSedes({ sedes, googleDisponible }: { sedes: Sede[], googleDisponible: boolean }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [ubicando, setUbicando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!edicion) return
    if (!edicion.nombre.trim() || !edicion.direccion.trim()) return toast.error("Indique el nombre y la dirección de la sede")
    if (!googleDisponible && (edicion.latitud === null || edicion.longitud === null)) return toast.error("Ubique la sede en el mapa")

    setGuardando(true)
    const r = await llamarApi<Sede>(edicion.id ? `/mensajeria/sedes/${edicion.id}` : "/mensajeria/sedes", edicion.id ? "PUT" : "POST", edicion)
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    if (r.datos.latitud === null) toast.warning("No se pudo ubicar la dirección: ubique la sede en el mapa")
    else toast.success("Sede guardada")
    setEdicion(null)
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
        <Building2 size={15} />
        Sedes
      </button>

      <Dialog open={abierto} onClose={() => !guardando && setAbierto(false)} className="relative z-[900]">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <DialogTitle className="text-sm font-semibold text-slate-800">Sedes de mensajería</DialogTitle>
                <p className="mt-0.5 text-xs text-slate-400">Oficinas de las que salen los mensajeros. La ruta se optimiza desde aquí.</p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="space-y-3 px-6 py-5">
              {edicion ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Nombre</span>
                    <input value={edicion.nombre} onChange={e => setEdicion({ ...edicion, nombre: e.target.value })} maxLength={100} placeholder="Ej: Medellín" className={claseInput} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Dirección</span>
                    <input value={edicion.direccion} onChange={e => setEdicion({ ...edicion, direccion: e.target.value, ...(googleDisponible ? { latitud: null, longitud: null } : {}) })} maxLength={300} placeholder="Ej: Cra 43A # 1-50, Medellín" className={claseInput} />
                  </label>
                  <div className="flex items-center justify-between text-xs">
                    <span className={edicion.latitud === null ? "text-amber-700" : "text-slate-500"}>
                      {edicion.latitud === null
                        ? (googleDisponible ? "Se ubicará con Google al guardar" : "Sin ubicar")
                        : `Ubicada: ${edicion.latitud.toFixed(5)}, ${edicion.longitud?.toFixed(5)}`}
                    </span>
                    <button type="button" onClick={() => setUbicando(true)} className="font-medium text-sky-600 hover:underline">Ubicar en el mapa</button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={edicion.activo} onChange={e => setEdicion({ ...edicion, activo: e.target.checked })} className="h-4 w-4 accent-sky-500" />
                    Activa
                  </label>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setEdicion(null)} disabled={guardando} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Volver</button>
                    <button type="button" onClick={guardar} disabled={guardando} className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
                      {guardando && <Loader2 size={15} className="animate-spin" />}
                      Guardar sede
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {sedes.map(s => (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-xs">
                        {s.latitud === null ? <MapPinOff size={15} className="shrink-0 text-amber-600" /> : <MapPin size={15} className="shrink-0 text-slate-400" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-700">{s.nombre}{s.activo === false && <span className="ml-2 font-normal text-slate-400">(inactiva)</span>}</p>
                          <p className="truncate text-slate-500">{s.direccion}</p>
                        </div>
                        <button type="button" onClick={() => setEdicion({ id: s.id, nombre: s.nombre, direccion: s.direccion, latitud: s.latitud, longitud: s.longitud, activo: s.activo !== false })}
                          className="p-1.5 text-slate-400 hover:text-sky-600" aria-label={`Editar ${s.nombre}`}>
                          <Pencil size={14} />
                        </button>
                      </li>
                    ))}
                    {sedes.length === 0 && <li className="px-4 py-6 text-center text-xs text-slate-400">Aún no hay sedes.</li>}
                  </ul>
                  <button type="button" onClick={() => setEdicion({ nombre: "", direccion: "", latitud: null, longitud: null, activo: true })}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-sky-500 px-3 text-xs font-semibold text-white hover:bg-sky-600">
                    <Plus size={15} /> Nueva sede
                  </button>
                </>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {ubicando && edicion && (
        <ModalUbicacion
          titulo={`Ubicación de la sede ${edicion.nombre || ""}`}
          direccion={edicion.direccion || null}
          puntoInicial={edicion.latitud !== null && edicion.longitud !== null ? { latitud: edicion.latitud, longitud: edicion.longitud } : null}
          onGuardar={async punto => {
            setEdicion({ ...edicion, ...punto })
            return true
          }}
          onCerrar={() => setUbicando(false)}
        />
      )}
    </>
  )
}
