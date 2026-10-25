"use client"

import { useState } from "react"
import clsx from "clsx"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, Plus, Search, X } from "lucide-react"
import { toast } from "react-toastify"
import { llamarApi } from "@/src/lib/apiCliente"

type TramiteParaRuta = {
  id: number
  cliente: string | null
  direccion: string | null
  municipio: string | null
  tramitador: string | null
  fechaDiligencia: string | null
  problema: string | null
}

// "2026-10-24" → "24/10/2026" (sin toLocale: este componente se dibuja en el cliente)
const fechaCorta = (fecha: string | null) => (fecha ? fecha.split("-").reverse().join("/") : null)

// "3769, 3770 3771" → [3769, 3770, 3771]
const leerNumeros = (texto: string) =>
  [...new Set(texto.split(/[^0-9]+/).filter(Boolean).map(Number).filter(n => n > 0))]

// Agrega trámites a la ruta de un mensajero para el día que se está viendo: les asigna el
// mensajero y la fecha de diligencia (el backend manda los avisos de siempre)
export default function ModalAgregarTramites({ mensajeroId, mensajero, fecha, onAgregados, onCerrar }: {
  mensajeroId: number
  mensajero: string
  fecha: string
  onAgregados: () => void
  onCerrar: () => void
}) {
  const [texto, setTexto] = useState("")
  const [revision, setRevision] = useState<TramiteParaRuta[] | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [agregando, setAgregando] = useState(false)

  const numeros = leerNumeros(texto)
  const validos = revision?.filter(t => !t.problema) ?? []

  const revisar = async () => {
    if (!numeros.length) return
    setRevisando(true)
    const r = await llamarApi<TramiteParaRuta[]>(`/mensajeria/rutas/${mensajeroId}/agregar/revisar`, "POST", { fecha, tramiteIds: numeros })
    setRevisando(false)
    if (!r.ok) return toast.error(r.error)
    setRevision(r.datos)
  }

  const agregar = async () => {
    if (!validos.length) return
    setAgregando(true)
    const r = await llamarApi<{ agregados: number[], rechazados: { id: number, motivo: string }[] }>(
      `/mensajeria/rutas/${mensajeroId}/agregar`, "POST", { fecha, tramiteIds: validos.map(t => t.id) }
    )
    setAgregando(false)
    if (!r.ok) return toast.error(r.error)
    const { agregados, rechazados } = r.datos
    if (agregados.length) toast.success(`${agregados.length} trámite(s) agregado(s) a la ruta de ${mensajero}`)
    rechazados.forEach(t => toast.error(`#${t.id}: ${t.motivo}`))
    if (agregados.length) {
      onAgregados()
      onCerrar()
    }
  }

  return (
    <Dialog open onClose={() => !agregando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-xl rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-slate-800">Agregar trámites a la ruta</DialogTitle>
              <p className="mt-0.5 truncate text-xs text-slate-500">{mensajero} · {fechaCorta(fecha)}</p>
            </div>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="space-y-3 px-6 py-4">
            <div className="space-y-1.5">
              <label htmlFor="numerosTramites" className="block text-xs font-medium text-slate-600">Números de los trámites</label>
              <div className="flex gap-2">
                <input
                  id="numerosTramites"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={texto}
                  onChange={e => { setTexto(e.target.value); setRevision(null) }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); revisar() } }}
                  placeholder="Ej: 3769, 3770"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <button type="button" onClick={revisar} disabled={!numeros.length || revisando}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {revisando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  Revisar
                </button>
              </div>
            </div>

            {revision && (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                {revision.map(t => (
                  <li key={t.id} className={clsx("px-3 py-2 text-xs", t.problema && "bg-slate-50")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">#{t.id} {t.cliente && <span className="font-normal text-slate-500">· {t.cliente}</span>}</span>
                      {t.problema
                        ? <span className="shrink-0 rounded-full bg-amber-50 px-2 py-px text-[10px] font-semibold text-amber-700">{t.problema}</span>
                        : <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-px text-[10px] font-semibold text-emerald-700">Se agrega</span>}
                    </div>
                    {(t.direccion || t.municipio) && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{[t.direccion, t.municipio].filter(Boolean).join(", ")}</p>
                    )}
                    {!t.problema && (t.tramitador || t.fechaDiligencia) && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Hoy: {t.tramitador ?? "sin tramitador"} · {t.fechaDiligencia ? `diligencia ${fechaCorta(t.fechaDiligencia)}` : "sin programación"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onCerrar} disabled={agregando} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="button" onClick={agregar} disabled={!validos.length || agregando}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-500 px-4 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
              {agregando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {validos.length ? `Agregar ${validos.length}` : "Agregar"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
