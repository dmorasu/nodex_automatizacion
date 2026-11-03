"use client"

import { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
import clsx from "clsx"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, X } from "lucide-react"
import EvaluacionModal from "@/components/evaluacion/evaluacionModal"
import { claseBotonSecundario } from "@/components/ui/estilos"
import { NOMBRES_RESPUESTA, fechaCorta, nivel, numero, type CalificacionesPorTramite } from "@/src/calificaciones"

type Respuesta = { id: number, calificacion: number, pregunta?: { texto: string, orden: number } }

// Finalizados del periodo con su calificación. Los calificados muestran las respuestas al
// desplegarlos; los que no tienen, el botón para hacer la encuesta.
export default function TablaCalificacionesTramites({ datos, pagina, parametros }: { datos: CalificacionesPorTramite, pagina: number, parametros: string }) {
  const router = useRouter()
  const [encuesta, setEncuesta] = useState<number | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [respuestas, setRespuestas] = useState<Record<number, Respuesta[] | "cargando" | "error">>({})

  const verRespuestas = async (id: number) => {
    if (abierto === id) return setAbierto(null)
    setAbierto(id)
    if (respuestas[id] && respuestas[id] !== "error") return
    setRespuestas(r => ({ ...r, [id]: "cargando" }))
    try {
      const res = await fetch(`/api/backend/solicitudes/${id}/evaluacion`)
      const json = await res.json()
      const lista: Respuesta[] = res.ok && json?.respuestas ? json.respuestas : []
      lista.sort((a, b) => (a.pregunta?.orden ?? 0) - (b.pregunta?.orden ?? 0))
      setRespuestas(r => ({ ...r, [id]: res.ok ? lista : "error" }))
    } catch {
      setRespuestas(r => ({ ...r, [id]: "error" }))
    }
  }

  const paginas = Math.max(1, Math.ceil(datos.total / datos.porPagina))
  const enlace = (p: number) => {
    const q = new URLSearchParams(parametros)
    q.set("pagina", String(p))
    return `/center/calificaciones?vista=tramites&${q}`
  }

  if (datos.tramites.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">No hay trámites con estos filtros.</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Trámite</th>
              <th className="px-4 py-3 font-semibold">Creado por</th>
              <th className="px-4 py-3 font-semibold">Tramitador</th>
              <th className="px-4 py-3 font-semibold">Finalizado</th>
              <th className="px-4 py-3 font-semibold">Calificación</th>
              <th className="px-4 py-3 font-semibold">Evaluado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {datos.tramites.map(t => {
              const lista = respuestas[t.id]
              return (
                <Fragment key={t.id}>
                  <tr className={clsx("hover:bg-slate-50", abierto === t.id && "bg-sky-50/40")}>
                    <td className="px-4 py-3">
                      <a href={`/center/solicitudTramites/${t.id}`} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">#{t.id}</a>
                      <p className="text-[11px] text-slate-500">{[t.placa, t.tipo].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.creadoPor ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{t.tramitador ?? "Sin tramitador"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fechaCorta(t.finalizado)}</td>
                    <td className="px-4 py-3">
                      {t.promedio === null ? (
                        <button type="button" onClick={() => setEncuesta(t.id)} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                          <ClipboardCheck size={14} /> Hacer encuesta
                        </button>
                      ) : (
                        <button type="button" onClick={() => verRespuestas(t.id)} aria-expanded={abierto === t.id}
                          className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", nivel(t.promedio).clase)}>
                          {numero(t.promedio)} · {nivel(t.promedio).nombre}
                          <ChevronDown size={12} className={clsx("transition", abierto === t.id && "rotate-180")} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.evaluadaPor ?? "—"}
                      {t.evaluadaEn && <p className="text-[11px] text-slate-400">{fechaCorta(t.evaluadaEn)}</p>}
                    </td>
                  </tr>
                  {abierto === t.id && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={6} className="px-4 py-3">
                        {lista === "cargando" && <p className="flex items-center gap-2 text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando…</p>}
                        {lista === "error" && <p className="text-red-600">No se pudieron cargar las respuestas.</p>}
                        {Array.isArray(lista) && (
                          <ul className="grid gap-2 md:grid-cols-2">
                            {lista.map(r => (
                              <li key={r.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                                <span className="text-slate-600">{r.pregunta?.texto ?? "Pregunta"}</span>
                                <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", nivel(r.calificacion).clase)}>
                                  {NOMBRES_RESPUESTA[r.calificacion] ?? r.calificacion}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          Página {pagina} de {paginas}
          <a href={enlace(pagina - 1)} className={clsx(claseBotonSecundario, "!h-8 !px-2", pagina <= 1 && "pointer-events-none opacity-40")} aria-label="Anterior"><ChevronLeft size={15} /></a>
          <a href={enlace(pagina + 1)} className={clsx(claseBotonSecundario, "!h-8 !px-2", pagina >= paginas && "pointer-events-none opacity-40")} aria-label="Siguiente"><ChevronRight size={15} /></a>
        </div>
      )}

      {encuesta && (
        <Dialog open onClose={() => setEncuesta(null)} className="relative z-50">
          <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                <DialogTitle className="text-sm font-semibold text-slate-800">Encuesta del trámite #{encuesta}</DialogTitle>
                <button type="button" onClick={() => setEncuesta(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
              </div>
              <div className="overflow-y-auto px-6 py-5">
                <EvaluacionModal solicitudId={encuesta} closeModal={() => setEncuesta(null)} onTerminar={() => router.refresh()} />
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </div>
  )
}
