"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import { toast } from "react-toastify"
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Clock, Loader2, X } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import {
  bloquesDelDia,
  duracionTexto,
  fechaCorta,
  fechaLarga,
  hora12,
  type AgendaDelDia,
  type BloqueAgenda,
  type MensajeroAgenda,
  type ReservaAgenda
} from "@/src/agenda"
import type { Sede } from "@/src/rutas"
import SelectBuscable from "@/components/ui/SelectBuscable"
import ModalReserva, { type ReservaPropuesta } from "./ModalReserva"

const claseControl = "h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

const moverDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10)

export default function PanelAgenda({ agenda, sedes, esTorreControl }: {
  agenda: AgendaDelDia
  sedes: Sede[]
  esTorreControl: boolean
}) {
  const router = useRouter()
  const parametros = useSearchParams()
  const [reservando, setReservando] = useState<ReservaPropuesta | null>(null)
  // En días pasados no se reserva
  const puedeReservar = agenda.fecha >= agenda.hoy

  const ir = (cambios: Record<string, string>) => {
    const nuevos = new URLSearchParams(parametros.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor)
      else nuevos.delete(clave)
    }
    router.push(`/center/agenda?${nuevos}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
          <button type="button" onClick={() => ir({ fecha: moverDias(agenda.fecha, -1) })} className="h-9 px-2 text-slate-500 hover:text-slate-700" aria-label="Día anterior"><ChevronLeft size={16} /></button>
          <input type="date" value={agenda.fecha} onChange={e => e.target.value && ir({ fecha: e.target.value })} className="h-9 border-x border-slate-200 px-2 text-xs text-slate-700 outline-none" aria-label="Día" />
          <button type="button" onClick={() => ir({ fecha: moverDias(agenda.fecha, 1) })} className="h-9 px-2 text-slate-500 hover:text-slate-700" aria-label="Día siguiente"><ChevronRight size={16} /></button>
        </div>
        {agenda.fecha !== agenda.hoy && (
          <button type="button" onClick={() => ir({ fecha: agenda.hoy })} className="h-9 px-2 text-xs font-medium text-sky-600 hover:underline">Hoy</button>
        )}
        <span className="text-xs font-medium text-slate-500">{fechaLarga(agenda.fecha)}</span>

        {sedes.length > 0 && (
          <SelectBuscable value={parametros.get("sedeId") ?? ""} onChange={e => ir({ sedeId: e.target.value })} className={clsx(claseControl, "ml-auto")} aria-label="Sede">
            <option value="">Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </SelectBuscable>
        )}
      </div>

      {agenda.mensajeros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">No hay mensajeros activos.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agenda.mensajeros.map(m => (
            <TarjetaMensajero
              key={m.id}
              mensajero={m}
              esTorreControl={esTorreControl}
              puedeReservar={puedeReservar}
              onReservar={(inicio, fin) => setReservando({ mensajeroId: m.id, mensajero: m.nombre, inicio, fin })}
              onCambio={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {reservando && (
        <ModalReserva
          fecha={agenda.fecha}
          propuesta={reservando}
          onCerrar={() => setReservando(null)}
          onReservada={() => { setReservando(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function TarjetaMensajero({ mensajero, esTorreControl, puedeReservar, onReservar, onCambio }: {
  mensajero: MensajeroAgenda
  esTorreControl: boolean
  puedeReservar: boolean
  onReservar: (inicio?: string, fin?: string) => void
  onCambio: () => void
}) {
  const bloques = bloquesDelDia(mensajero)
  const ocupado = mensajero.citas.length + mensajero.reservas.length

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-700">{mensajero.nombre}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {mensajero.sede ?? "Sin sede"} · {mensajero.citas.length} cita(s) · {mensajero.reservas.length} reserva(s) · {mensajero.sinHora.length} sin hora
          </p>
        </div>
        {puedeReservar && (
          <button type="button" onClick={() => onReservar()} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
            <CalendarPlus size={14} /> Reservar
          </button>
        )}
      </div>

      <ol className="flex-1 space-y-2 p-4">
        {bloques.map(b => (
          <li key={`${b.tipo}-${b.inicio}-${b.tipo === "cita" ? b.cita.tramiteId : b.tipo === "reserva" ? b.reserva.id : b.fin}`}>
            <Bloque bloque={b} esTorreControl={esTorreControl} puedeReservar={puedeReservar} onReservar={onReservar} onCambio={onCambio} />
          </li>
        ))}
        {ocupado === 0 && bloques.length === 0 && <li className="text-xs text-slate-400">Sin citas ni reservas.</li>}
      </ol>

      {mensajero.sinHora.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sin hora</p>
          <ul className="flex flex-wrap gap-1.5">
            {mensajero.sinHora.map(t => (
              <li key={t.tramiteId}>
                <NumeroTramite id={t.tramiteId} esTorreControl={esTorreControl}
                  titulo={[t.tramite, t.placa, t.municipio, t.estado, t.requiereCita ? "Requiere cita (sin hora)" : null].filter(Boolean).join(" · ")}
                  className={clsx("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    t.requiereCita ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600")} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// Número del trámite: Torre de control lo abre; Gestión de activos solo lo ve
function NumeroTramite({ id, esTorreControl, titulo, className }: { id: number, esTorreControl: boolean, titulo?: string, className?: string }) {
  return esTorreControl
    ? <Link href={`/center/solicitudTramites/${id}`} title={titulo} className={clsx(className, "hover:underline")}>#{id}</Link>
    : <span title={titulo} className={className}>#{id}</span>
}

const Horario = ({ inicio, fin, aproximado }: { inicio: string, fin: string, aproximado?: boolean }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums">
    <Clock size={12} /> {hora12(inicio)} – <span className={clsx(aproximado && "opacity-60")} title={aproximado ? "Sin hora final" : undefined}>{hora12(fin)}</span>
  </span>
)

function Bloque({ bloque, esTorreControl, puedeReservar, onReservar, onCambio }: {
  bloque: BloqueAgenda
  esTorreControl: boolean
  puedeReservar: boolean
  onReservar: (inicio?: string, fin?: string) => void
  onCambio: () => void
}) {
  if (bloque.tipo === "libre") {
    const contenido = (
      <>
        <span className="text-[11px] font-medium tabular-nums">{hora12(bloque.inicio)} – {hora12(bloque.fin)}</span>
        <span className="text-[11px]">Libre · {duracionTexto(bloque.minutos)}</span>
      </>
    )
    return puedeReservar ? (
      <button type="button" onClick={() => onReservar(bloque.inicio, bloque.fin)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-500 transition hover:border-sky-300 hover:bg-sky-50/50 hover:text-sky-700">
        {contenido}
      </button>
    ) : (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-slate-400">{contenido}</div>
    )
  }

  if (bloque.tipo === "reserva") return <BloqueReserva reserva={bloque.reserva} esTorreControl={esTorreControl} onCambio={onCambio} />

  const c = bloque.cita
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-sky-900">
      <div className="flex items-center justify-between gap-2">
        <Horario inicio={c.inicio} fin={c.fin} aproximado={c.sinHoraFin} />
        <NumeroTramite id={c.tramiteId} esTorreControl={esTorreControl} className="text-[11px] font-semibold text-sky-700" />
      </div>
      <p className="mt-1 text-xs font-medium text-slate-700">{c.tramite ?? "Trámite"}</p>
      <p className="text-[11px] text-slate-500">{[c.placa, c.municipio, c.estado].filter(Boolean).join(" · ")}</p>
      {c.fechaCitaDistinta && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
          <AlertTriangle size={12} /> Cita del {fechaCorta(c.fechaCitaDistinta)}
        </p>
      )}
    </div>
  )
}

function BloqueReserva({ reserva, esTorreControl, onCambio }: { reserva: ReservaAgenda, esTorreControl: boolean, onCambio: () => void }) {
  const [cancelando, setCancelando] = useState(false)

  const cancelar = async () => {
    if (!confirm(`¿Cancelar la reserva de ${hora12(reserva.inicio)} a ${hora12(reserva.fin)}?`)) return
    setCancelando(true)
    const r = await llamarApi<{ mensaje: string }>(`/agenda-mensajeros/reservas/${reserva.id}/cancelar`, "POST", {})
    setCancelando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(r.datos.mensaje)
    onCambio()
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-900">
      <div className="flex items-center justify-between gap-2">
        <Horario inicio={reserva.inicio} fin={reserva.fin} />
        <span className="flex items-center gap-2">
          {reserva.tramiteId && <NumeroTramite id={reserva.tramiteId} esTorreControl={esTorreControl} className="text-[11px] font-semibold text-amber-800" />}
          {reserva.puedeCancelar && (
            <button type="button" onClick={cancelar} disabled={cancelando} className="text-amber-700 hover:text-red-600 disabled:opacity-50" aria-label="Cancelar reserva">
              {cancelando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            </button>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-slate-700">Reservado: {reserva.motivo}</p>
      <p className="text-[11px] text-slate-500">{reserva.creadaPor}</p>
    </div>
  )
}
