"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, MapPin, Search, X } from "lucide-react"
import type { Punto } from "./SelectorUbicacionLeaflet"
import { claveMapaGoogle } from "@/src/lib/googleMaps"
import CampoDireccion from "@/components/direcciones/CampoDireccion"

const cargandoMapa = () => <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>

// Con la clave del navegador se usa Google (igual que el mapa de rutas); sin ella, o si Google
// no carga, el mapa libre (OpenStreetMap)
const SelectorGoogle = dynamic(() => import("./SelectorUbicacionGoogle"), { ssr: false, loading: cargandoMapa })
const SelectorLibre = dynamic(() => import("./SelectorUbicacionLeaflet"), { ssr: false, loading: cargandoMapa })

// Centro de Colombia, si no hay otra referencia
const COLOMBIA: Punto = { latitud: 4.6, longitud: -74.1 }

// Ventana para poner o corregir una ubicación en el mapa (trámite o sede)
export default function ModalUbicacion({ titulo, direccion, direccionEditable, puntoInicial, centro, onGuardar, onBuscarGoogle, onCerrar }: {
  titulo: string
  direccion: string | null
  // Trámites: la dirección guardada, que se puede corregir aquí mismo (sin esto, solo se muestra)
  direccionEditable?: string | null
  puntoInicial: Punto | null
  // Dónde arranca el mapa si aún no hay punto (ej: la sede del mensajero)
  centro?: Punto | null
  // `direccionNueva` solo si se cambió la dirección
  onGuardar: (punto: Punto, direccionNueva?: string) => Promise<boolean>
  // Si Google está disponible: vuelve a ubicar la dirección automáticamente (la escrita, si cambió)
  onBuscarGoogle?: (direccionNueva?: string) => Promise<Punto | null>
  onCerrar: () => void
}) {
  const editable = direccionEditable !== undefined
  const [textoDireccion, setTextoDireccion] = useState(direccionEditable ?? "")
  // Lo escrito, solo si es distinto de la dirección guardada
  const direccionNueva = editable && textoDireccion.trim() !== (direccionEditable ?? "").trim() ? textoDireccion.trim() : undefined
  const [punto, setPunto] = useState<Punto | null>(puntoInicial)
  const [guardando, setGuardando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [conGoogle, setConGoogle] = useState(Boolean(claveMapaGoogle))

  const guardar = async () => {
    if (!punto) return
    setGuardando(true)
    const ok = await onGuardar(punto, direccionNueva)
    setGuardando(false)
    if (ok) onCerrar()
  }

  const buscar = async () => {
    if (!onBuscarGoogle) return
    setBuscando(true)
    const encontrado = await onBuscarGoogle(direccionNueva)
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
              {!editable && <p className="mt-0.5 truncate text-xs text-slate-500">{direccion ?? "Sin dirección"}</p>}
            </div>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="space-y-3 px-6 py-4">
            {editable && (
              <div className="space-y-1.5">
                <label htmlFor="direccionUbicacion" className="block text-xs font-medium text-slate-600">Dirección del trámite</label>
                <CampoDireccion name="direccionUbicacion" defaultValue={direccionEditable} onTexto={setTextoDireccion} onLugar={setPunto} />
              </div>
            )}
            <p className="text-xs text-slate-500">Haga clic en el mapa donde queda la dirección o arrastre el marcador para corregirla.</p>
            <div className="relative z-0 h-[420px]">
              {conGoogle
                ? <SelectorGoogle punto={punto} centroInicial={punto ?? centro ?? COLOMBIA} onCambiar={setPunto} onError={() => setConGoogle(false)} />
                : <SelectorLibre punto={punto} centroInicial={punto ?? centro ?? COLOMBIA} onCambiar={setPunto} />}
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
              <button type="button" onClick={guardar} disabled={!punto || guardando || (editable && !textoDireccion.trim())}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
                {guardando && <Loader2 size={15} className="animate-spin" />}
                {direccionNueva ? "Guardar dirección y ubicación" : "Guardar ubicación"}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
