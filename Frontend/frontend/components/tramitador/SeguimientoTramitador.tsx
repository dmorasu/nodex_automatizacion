"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { CircleCheckBig, HardHat, Loader2, MessagesSquare, Send, User } from "lucide-react"
import { comentarAlTramitador } from "@/actions/seguimiento-tramitador-action"
import type { Seguimiento } from "@/src/seguimientoTramitador"
import RevisarReporte from "./RevisarReporte"
import DevolverReporte from "./DevolverReporte"
import { usePerfil } from "@/src/auth/PerfilContexto"

const formatoFechaHora = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })

// Pestaña "Tramitador" del detalle del trámite: lo que el tramitador reporta desde
// la app (realizado y comentarios) y las respuestas del equipo
export default function SeguimientoTramitador({
  solicitudTramiteId,
  seguimiento,
  tramitador
}: {
  solicitudTramiteId: number
  seguimiento: Seguimiento
  tramitador: string | null
}) {
  const [comentario, setComentario] = useState("")
  const [enviando, startEnviar] = useTransition()
  // Revisar el reporte de "realizado" es de Torre de control (Gestión de activos solo lo ve)
  const esTorreControl = usePerfil() === "TORRE_CONTROL"

  const enviar = () => {
    if (!comentario.trim()) return toast.error("Escriba el comentario")
    startEnviar(async () => {
      const resultado = await comentarAlTramitador(solicitudTramiteId, comentario)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      setComentario("")
      toast.success("Comentario enviado: el tramitador lo verá en la app")
    })
  }

  return (
    <div className="space-y-8">

      {/* REPORTES DE REALIZADO */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <CircleCheckBig size={17} className="text-sky-500" />
          Reportado como realizado
        </h3>

        {seguimiento.reportes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-slate-50 px-4 py-6 text-center text-xs text-gray-400">
            El tramitador no ha reportado este trámite como realizado.
          </p>
        ) : (
          <div className="space-y-3">
            {seguimiento.reportes.map(r => (
              <div
                key={r.id}
                className={`rounded-lg border p-4 text-xs ${r.estado === "PENDIENTE" ? "border-amber-200 bg-amber-50" : r.estado === "DEVUELTO" ? "border-red-200 bg-red-50" : "border-gray-200 bg-slate-50"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {r.tramitador ?? "Tramitador"} lo reportó como realizado
                    </p>
                    <p className="text-gray-500">{formatoFechaHora(r.fecha)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r.estado === "PENDIENTE" ? "border-amber-300 bg-white text-amber-700" : r.estado === "DEVUELTO" ? "border-red-200 bg-white text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {r.estado === "PENDIENTE" ? "Pendiente de revisión" : r.estado === "DEVUELTO" ? "Devuelto" : "Revisado"}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-line text-gray-700">{r.observacion}</p>

                {r.estado === "PENDIENTE" && !esTorreControl ? (
                  <p className="mt-2 text-[11px] text-amber-800">Pendiente de revisión por Torre de control.</p>
                ) : r.estado === "PENDIENTE" ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] text-amber-800">
                      El estado del trámite no cambia solo: revíselo y, si corresponde, actualice el estado a Finalizado.
                    </p>
                    <div className="flex flex-wrap items-start gap-2">
                      <RevisarReporte reporteId={r.id} solicitudTramiteId={solicitudTramiteId} />
                      <DevolverReporte reporteId={r.id} solicitudTramiteId={solicitudTramiteId} />
                    </div>
                  </div>
                ) : r.estado === "DEVUELTO" ? (
                  <p className="mt-2 text-[11px] text-red-800">
                    Devuelto por {r.revisor ?? "—"}{r.fechaRevision && ` el ${formatoFechaHora(r.fechaRevision)}`}
                    {r.notaRevision && <>: <span className="text-gray-700">{r.notaRevision}</span></>}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Revisado por {r.revisor ?? "—"}{r.fechaRevision && ` el ${formatoFechaHora(r.fechaRevision)}`}
                    {r.notaRevision && <>: <span className="text-gray-700">{r.notaRevision}</span></>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CONVERSACIÓN */}
      <section>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <MessagesSquare size={17} className="text-sky-500" />
          Comentarios con el tramitador
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          {tramitador
            ? `Lo que escriba aquí lo ve ${tramitador} en la app. No se envía al cliente ni queda en la trazabilidad.`
            : "El trámite no tiene tramitador asignado."}
        </p>

        <div className="mb-4 flex gap-2">
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Escriba un comentario para el tramitador"
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <button type="button" onClick={enviar} disabled={enviando || !tramitador} className="inline-flex items-center gap-2 self-end h-10 px-4 rounded-md bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar
          </button>
        </div>

        {seguimiento.comentarios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-slate-50 px-4 py-6 text-center text-xs text-gray-400">
            Aún no hay comentarios.
          </p>
        ) : (
          <ul className="space-y-3">
            {seguimiento.comentarios.map(c => {
              const esTramitador = c.autor.tipo === "TRAMITADOR"
              return (
                <li key={c.id} className={`flex gap-3 rounded-lg border p-3 text-xs ${esTramitador ? "border-sky-100 bg-sky-50/60" : "border-gray-200 bg-white"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${esTramitador ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-500"}`}>
                    {esTramitador ? <HardHat size={15} /> : <User size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-500">
                      <b className="text-gray-700">{c.autor.nombre}</b>
                      {esTramitador ? " · tramitador" : ""} · {formatoFechaHora(c.fecha)}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-gray-800">{c.comentario}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
