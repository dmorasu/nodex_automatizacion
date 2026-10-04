"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, MapPin, Search, X } from "lucide-react"
import type { Punto } from "./SelectorUbicacionLeaflet"

const Selector = dynamic(() => import("./SelectorUbicacionLeaflet"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>
})

// Centro de Colombia, si no hay otra referencia
const COLOMBIA: Punto = { latitud: 4.6, longitud: -74.1 }

// Ventana para poner o corregir una ubicación en el mapa (trámite o sede)
export default function ModalUbicacion({ titulo, direccion, puntoInicial, centro, onGuardar, onBuscarGoogle, onCerrar }: {
  titulo: string
  direccion: string | null
  puntoInicial: Punto | null
  // Dónde arranca el mapa si aún no hay punto (ej: la sede del mensajero)
  centro?: Punto | null
  onGuardar: (punto: Punto) => Promise<boolean>
  // Si Google está disponible: vuelve a ubicar la dirección automáticamente
  onBuscarGoogle?: () => Promise<Punto | null>
  onCerrar: () => void
}) {
  const [punto, setPunto] = useState<Punto | null>(puntoInicial)
  const [guardando, setGuardando] = useState(false)
  const [buscando, setBuscando] = useState(false)

  const guardar = async () => {
    if (!punto) return
    setGuardando(true)
    const ok = await onGuardar(punto)
    setGuardando(false)
    if (ok) onCerrar()
  }

  const buscar = async () => {
    if (!onBuscarGoogle) return
    setBuscando(true)
    const encontrado = await onBuscarGoogle()
    setBuscando(false)
    if (encontrado) setPunto(encontrado)
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-[1000]">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-slate-800">{titulo}</DialogTitle>
              <p className="mt-0.5 truncate text-xs text-slate-500">{direccion ?? "Sin dirección"}</p>
            </div>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="space-y-3 px-6 py-4">
            <p className="text-xs text-slate-500">Haga clic en el mapa donde queda la dirección o arrastre el marcador para corregirla.</p>
            <div className="relative z-0 h-[420px]">
              <Selector punto={punto} centroInicial={punto ?? centro ?? COLOMBIA} onCambiar={setPunto} />
            </div>
            {punto && (
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <MapPin size={12} /> {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            {onBuscarGoogle ? (
              <button type="button" onClick={buscar} disabled={buscando || guardando}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Buscar la dirección con Google
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={onCerrar} disabled={guardando} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={!punto || guardando}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
                {guardando && <Loader2 size={15} className="animate-spin" />}
                Guardar ubicación
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
