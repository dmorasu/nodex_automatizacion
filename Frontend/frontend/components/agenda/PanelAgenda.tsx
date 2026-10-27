"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import { toast } from "react-toastify"
import { AlertTriangle, Ban, CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Clock, Copy, Hourglass, Inbox, Loader2, Search, Users, X, type LucideIcon } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import {
  bloquesDelDia,
  cargaDelDia,
  duracionTexto,
  fechaCorta,
  fechaLarga,
  filtrarMensajero,
  hora12,
  iniciales,
  noDisponibleTodoElDia,
  textoRutaWhatsApp,
  type AgendaDelDia,
  type BloqueAgenda,
  type MensajeroAgenda,
  type ReservaAgenda
} from "@/src/agenda"
import type { Sede } from "@/src/rutas"
import SelectBuscable from "@/components/ui/SelectBuscable"
import ModalReserva, { type ReservaPropuesta } from "./ModalReserva"
import BandejaSinMensajero from "./BandejaSinMensajero"
import { colorMensajero, type ColorMensajero } from "./colores"

const claseControl = "h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

const moverDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10)

const COLOR_ESTADO: Record<string, string> = {
  Disponible: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Ocupado: "border-amber-200 bg-amber-50 text-amber-800",
  Completo: "border-amber-200 bg-amber-50 text-amber-800",
  Sobrecargado: "border-red-200 bg-red-50 text-red-700",
  "No disponible": "border-red-200 bg-red-50 text-red-700"
}

export default function PanelAgenda({ agenda, sedes, esTorreControl }: {
  agenda: AgendaDelDia
  sedes: Sede[]
  esTorreControl: boolean
}) {
  const router = useRouter()
  const parametros = useSearchParams()
  const [espacio, setEspacio] = useState<ReservaPropuesta | null>(null)
  const [bandejaAbierta, setBandejaAbierta] = useState(false)
  const [busqueda, setBusqueda] = useState("")
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

  const visibles = agenda.mensajeros.map(m => filtrarMensajero(m, busqueda)).filter((m): m is MensajeroAgenda => m !== null)
  // El color va por la posición en la agenda completa: no cambia al buscar
  const colorDe = (id: number) => colorMensajero(Math.max(0, agenda.mensajeros.findIndex(m => m.id === id)))
  const indicadores: { titulo: string, valor: number, Icono: LucideIcon, color: string }[] = [
    { titulo: "Mensajeros", valor: agenda.mensajeros.length, Icono: Users, color: "bg-sky-50 text-sky-700" },
    { titulo: "Citas", valor: agenda.mensajeros.reduce((n, m) => n + m.citas.length, 0), Icono: CalendarCheck, color: "bg-indigo-50 text-indigo-700" },
    { titulo: "Sin hora", valor: agenda.mensajeros.reduce((n, m) => n + m.sinHora.length, 0), Icono: Hourglass, color: "bg-amber-50 text-amber-700" },
    { titulo: "Espacios libres", valor: agenda.mensajeros.reduce((n, m) => n + bloquesDelDia(m).filter(b => b.tipo === "libre").length, 0), Icono: CalendarPlus, color: "bg-emerald-50 text-emerald-700" },
    { titulo: "No disponibles", valor: agenda.mensajeros.reduce((n, m) => n + m.reservas.filter(r => r.tipo === "NO_DISPONIBLE").length, 0), Icono: Ban, color: "bg-rose-50 text-rose-700" }
  ]

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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar" className={clsx(claseControl, "w-48 pl-8")} aria-label="Buscar en la agenda" />
          </div>
          {sedes.length > 0 && (
            <SelectBuscable value={parametros.get("sedeId") ?? ""} onChange={e => ir({ sedeId: e.target.value })} className={claseControl} aria-label="Sede">
              <option value="">Todas las sedes</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </SelectBuscable>
          )}
          {esTorreControl && (
            <button type="button" onClick={() => setBandejaAbierta(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Inbox size={14} /> Sin mensajero
              {Boolean(agenda.sinMensajero) && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">{agenda.sinMensajero}</span>
              )}
            </button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {indicadores.map(({ titulo, valor, Icono, color }) => (
          <div key={titulo} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", color)}><Icono size={17} /></span>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">{titulo}</dt>
              <dd className="text-lg font-bold tabular-nums text-slate-800">{valor}</dd>
            </div>
          </div>
        ))}
      </dl>

      {agenda.mensajeros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">No hay mensajeros activos.</div>
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">Nada coincide con la búsqueda.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map(m => (
            <TarjetaMensajero
              key={m.id}
              mensajero={m}
              completo={agenda.mensajeros.find(x => x.id === m.id) ?? m}
              color={colorDe(m.id)}
              fecha={agenda.fecha}
              capacidad={agenda.capacidad}
              buscando={Boolean(busqueda.trim())}
              esTorreControl={esTorreControl}
              puedeReservar={puedeReservar}
              onEspacio={(inicio, fin, modo) => setEspacio({ mensajeroId: m.id, mensajero: m.nombre, inicio, fin, modo, color: colorDe(m.id) })}
              onCambio={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {bandejaAbierta && (
        <BandejaSinMensajero
          onCerrar={() => setBandejaAbierta(false)}
          onAsignar={tramite => { setBandejaAbierta(false); setEspacio({ modo: "asignar", tramite }) }}
        />
      )}

      {espacio && (
        <ModalReserva
          fecha={agenda.fecha}
          propuesta={espacio}
          mensajeros={agenda.mensajeros.filter(m => !noDisponibleTodoElDia(m)).map(m => ({ id: m.id, nombre: m.nombre }))}
          esTorreControl={esTorreControl}
          onCerrar={() => setEspacio(null)}
          onReservada={() => { setEspacio(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function TarjetaMensajero({ mensajero, completo, color, fecha, capacidad, buscando, esTorreControl, puedeReservar, onEspacio, onCambio }: {
  mensajero: MensajeroAgenda
  // El día sin filtrar: la carga y la ruta para WhatsApp no dependen de la búsqueda
  completo: MensajeroAgenda
  color: ColorMensajero
  fecha: string
  capacidad: number
  buscando: boolean
  esTorreControl: boolean
  puedeReservar: boolean
  onEspacio: (inicio?: string, fin?: string, modo?: ReservaPropuesta["modo"]) => void
  onCambio: () => void
}) {
  // Buscando no se muestran los espacios libres: solo lo que coincide
  const bloques = bloquesDelDia(mensajero).filter(b => !buscando || b.tipo !== "libre")
  const todoElDia = noDisponibleTodoElDia(completo)
  const carga = cargaDelDia(completo, capacidad)

  const copiarRuta = async () => {
    try {
      await navigator.clipboard.writeText(textoRutaWhatsApp(completo, fecha))
      toast.success(`Ruta de ${completo.nombre} copiada`)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={clsx("h-1", color.franja)} />
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", color.fondo)}>{iniciales(mensajero.nombre)}</span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-800">{mensajero.nombre}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {mensajero.sede ?? "Sin sede"} · {completo.citas.length} cita(s) · {completo.sinHora.length} sin hora
              </p>
            </div>
          </div>
          <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", COLOR_ESTADO[carga.estado])}>{carga.estado}</span>
        </div>

        {!todoElDia && (
          <div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>{carga.diligencias} de {capacidad} citas</span>
              <span className="tabular-nums">{carga.porcentaje}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={clsx("h-full rounded-full transition-all", carga.porcentaje >= 100 ? "bg-red-500" : carga.porcentaje >= 66 ? "bg-amber-500" : color.barra)} style={{ width: `${carga.porcentaje}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* La ruta para WhatsApp es de Torre de control (decisión del usuario) */}
          {esTorreControl && (
            <button type="button" onClick={copiarRuta} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <Copy size={14} /> Copiar ruta
            </button>
          )}
          {puedeReservar && !todoElDia && (
            <button type="button" onClick={() => onEspacio()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
              <CalendarPlus size={14} /> Reservar
            </button>
          )}
          {puedeReservar && esTorreControl && !todoElDia && (
            <button type="button" onClick={() => onEspacio(undefined, undefined, "noDisponible")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Ban size={14} /> No disponible
            </button>
          )}
        </div>
      </div>

      <ol className="flex-1 space-y-2 p-4">
        {bloques.map(b => (
          <li key={`${b.tipo}-${b.inicio}-${b.tipo === "cita" ? b.cita.tramiteId : b.tipo === "reserva" ? b.reserva.id : b.fin}`}>
            <Bloque bloque={b} color={color} esTorreControl={esTorreControl} puedeReservar={puedeReservar} onEspacio={onEspacio} onCambio={onCambio} />
          </li>
        ))}
        {bloques.length === 0 && <li className="text-xs text-slate-400">Sin citas ni reservas.</li>}
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

function Bloque({ bloque, color, esTorreControl, puedeReservar, onEspacio, onCambio }: {
  bloque: BloqueAgenda
  color: ColorMensajero
  esTorreControl: boolean
  puedeReservar: boolean
  onEspacio: (inicio?: string, fin?: string) => void
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
      <button type="button" onClick={() => onEspacio(bloque.inicio, bloque.fin)}
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
    <div className={clsx("rounded-lg border px-3 py-2", color.cita)}>
      <div className="flex items-center justify-between gap-2">
        <Horario inicio={c.inicio} fin={c.fin} aproximado={c.sinHoraFin} />
        <NumeroTramite id={c.tramiteId} esTorreControl={esTorreControl} className={clsx("text-[11px] font-bold", color.numero)} />
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
  const noDisponible = reserva.tipo === "NO_DISPONIBLE"

  const cancelar = async () => {
    const pregunta = noDisponible
      ? `¿Quitar "No disponible" (${reserva.motivo})?`
      : `¿Cancelar la reserva de ${hora12(reserva.inicio)} a ${hora12(reserva.fin)}?`
    if (!confirm(pregunta)) return
    setCancelando(true)
    const r = await llamarApi<{ mensaje: string }>(`/agenda-mensajeros/reservas/${reserva.id}/cancelar`, "POST", {})
    setCancelando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(r.datos.mensaje)
    onCambio()
  }

  return (
    <div className={clsx("rounded-lg border px-3 py-2", noDisponible ? "border-red-200 bg-red-50/70 text-red-900" : "border-amber-200 bg-amber-50/70 text-amber-900")}>
      <div className="flex items-center justify-between gap-2">
        {reserva.diaCompleto
          ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold"><Ban size={12} /> Todo el día</span>
          : <Horario inicio={reserva.inicio} fin={reserva.fin} />}
        <span className="flex items-center gap-2">
          {reserva.tramiteId && <NumeroTramite id={reserva.tramiteId} esTorreControl={esTorreControl} className="text-[11px] font-semibold text-amber-800" />}
          {reserva.puedeCancelar && (
            <button type="button" onClick={cancelar} disabled={cancelando} className="opacity-70 hover:text-red-600 hover:opacity-100 disabled:opacity-50" aria-label={noDisponible ? "Quitar no disponible" : "Cancelar reserva"}>
              {cancelando ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            </button>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-slate-700">{noDisponible ? "No disponible" : "Reservado"}: {reserva.motivo}</p>
      <p className="text-[11px] text-slate-500">{reserva.creadaPor}</p>
    </div>
  )
}
