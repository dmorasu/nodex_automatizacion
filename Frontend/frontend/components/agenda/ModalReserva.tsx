"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import clsx from "clsx"
import { Ban, CalendarPlus, Loader2, UserCheck, X } from "lucide-react"
import { toast } from "react-toastify"
import { llamarApi } from "@/src/lib/apiCliente"
import {
  aHora,
  aMinutos,
  duracionTexto,
  fechaCorta,
  hora12,
  iniciales,
  MOTIVOS_NO_DISPONIBLE,
  opcionesDeHora,
  type TramiteSinMensajero
} from "@/src/agenda"
import SelectBuscable from "@/components/ui/SelectBuscable"
import type { ColorMensajero } from "./colores"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"

export type ModoEspacio = "reserva" | "noDisponible" | "asignar"

// De dónde se abre: un espacio libre o el botón de un mensajero (mensajero y horas), o la
// bandeja de sin mensajero (el trámite; el mensajero se elige aquí)
export type ReservaPropuesta = {
  mensajeroId?: number
  mensajero?: string
  inicio?: string
  fin?: string
  modo?: ModoEspacio
  tramite?: TramiteSinMensajero
  color?: ColorMensajero
}

// Duraciones rápidas desde la hora de inicio
const DURACIONES = [30, 60, 90]

const MODOS: { modo: ModoEspacio, texto: string }[] = [
  { modo: "reserva", texto: "Reservar" },
  { modo: "noDisponible", texto: "No disponible" },
  { modo: "asignar", texto: "Asignar trámite" }
]

const OTRO = "Otro"

const resumenTramite = (t: TramiteSinMensajero) =>
  `#${t.id} · ${[t.tramite, t.placa, t.municipio].filter(Boolean).join(" · ")}`

// Espacio en la agenda del mensajero. Gestión de activos solo reserva; Torre de control también
// marca "No disponible" (por horas o todo el día) y asigna un trámite sin mensajero con su cita.
// Desde un espacio libre propone su inicio y una hora (o lo que quede del espacio).
export default function ModalReserva({ fecha, propuesta, mensajeros, esTorreControl, onCerrar, onReservada }: {
  fecha: string
  propuesta: ReservaPropuesta
  mensajeros: { id: number, nombre: string }[]
  esTorreControl: boolean
  onCerrar: () => void
  onReservada: () => void
}) {
  const inicioPropuesto = propuesta.inicio ?? ""
  const finPropuesto = propuesta.inicio && propuesta.fin
    ? aHora(Math.min(aMinutos(propuesta.inicio) + 60, aMinutos(propuesta.fin)))
    : ""
  const [modo, setModo] = useState<ModoEspacio>(propuesta.modo ?? "reserva")
  const [datos, setDatos] = useState({
    mensajeroId: propuesta.mensajeroId ? String(propuesta.mensajeroId) : "",
    horaInicio: inicioPropuesto,
    horaFin: finPropuesto,
    motivo: "",
    motivoNoDisponible: MOTIVOS_NO_DISPONIBLE[0],
    tramite: "",
    tramiteAsignar: propuesta.tramite ? String(propuesta.tramite.id) : "",
    diaCompleto: false
  })
  const [pendientes, setPendientes] = useState<TramiteSinMensajero[] | null>(propuesta.tramite ? [propuesta.tramite] : null)
  const [guardando, setGuardando] = useState(false)

  // Los trámites sin mensajero se traen solo al elegir "Asignar trámite" desde un espacio
  useEffect(() => {
    if (modo !== "asignar" || pendientes) return
    let vigente = true
    llamarApi<TramiteSinMensajero[]>("/agenda-mensajeros/sin-mensajero").then(r => {
      if (!vigente) return
      if (r.ok) setPendientes(r.datos)
      else { setPendientes([]); toast.error(r.error) }
    })
    return () => { vigente = false }
  }, [modo, pendientes])

  const cambiar = (campo: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDatos(d => ({ ...d, [campo]: e.target.value }))
  const todoElDia = modo === "noDisponible" && datos.diaCompleto
  const horasValidas = todoElDia || Boolean(datos.horaInicio && datos.horaFin && datos.horaFin > datos.horaInicio)
  const mensajeroNombre = propuesta.mensajero ?? mensajeros.find(m => String(m.id) === datos.mensajeroId)?.nombre
  const horas = opcionesDeHora(datos.horaInicio, datos.horaFin, propuesta.inicio ?? "", propuesta.fin ?? "")
  // "Todo el espacio": hasta donde termina el espacio libre que se tocó
  const finDelEspacio = propuesta.fin && datos.horaInicio && aMinutos(propuesta.fin) > aMinutos(datos.horaInicio) ? propuesta.fin : null
  const minutosElegidos = datos.horaInicio && datos.horaFin ? aMinutos(datos.horaFin) - aMinutos(datos.horaInicio) : 0
  // Al mover el inicio se conserva la duración elegida (una hora si no había)
  const cambiarInicio = (inicio: string) => setDatos(d => {
    const duracion = d.horaInicio && d.horaFin && aMinutos(d.horaFin) > aMinutos(d.horaInicio) ? aMinutos(d.horaFin) - aMinutos(d.horaInicio) : 60
    return { ...d, horaInicio: inicio, horaFin: inicio ? aHora(Math.min(aMinutos(inicio) + duracion, aMinutos("23:59"))) : d.horaFin }
  })
  const durar = (minutos: number) => setDatos(d => ({ ...d, horaFin: aHora(Math.min(aMinutos(d.horaInicio) + minutos, aMinutos("23:59"))) }))
  const claseDuracion = (activa: boolean) => clsx("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
    activa ? "border-sky-600 bg-sky-600 text-white" : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100")

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!datos.mensajeroId) return toast.error("Elija el mensajero")
    if (!horasValidas) return toast.error("La hora final debe ser posterior a la hora de inicio")

    let r: { ok: true } | { ok: false, error: string }
    setGuardando(true)
    if (modo === "asignar") {
      if (!datos.tramiteAsignar) { setGuardando(false); return toast.error("Elija el trámite") }
      r = await llamarApi("/agenda-mensajeros/asignar", "POST", {
        tramiteId: Number(datos.tramiteAsignar),
        tramitadorId: Number(datos.mensajeroId),
        fecha,
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin
      })
    } else {
      const noDisponible = modo === "noDisponible"
      const motivo = noDisponible && datos.motivoNoDisponible !== OTRO ? datos.motivoNoDisponible : datos.motivo.trim()
      if (!motivo) { setGuardando(false); return toast.error("Indique el motivo") }
      r = await llamarApi("/agenda-mensajeros/reservas", "POST", {
        tramitadorId: Number(datos.mensajeroId),
        fecha,
        tipo: noDisponible ? "NO_DISPONIBLE" : "RESERVA",
        diaCompleto: todoElDia,
        ...(!todoElDia && { horaInicio: datos.horaInicio, horaFin: datos.horaFin }),
        motivo,
        solicitudTramiteId: noDisponible ? null : datos.tramite.replace(/\D/g, "") || null
      })
    }
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(modo === "asignar" ? "Trámite asignado y cita programada" : modo === "noDisponible" ? "Mensajero marcado como no disponible" : "Espacio reservado")
    onReservada()
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
          <div className={clsx("h-1", propuesta.color?.franja ?? "bg-sky-600")} />
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {propuesta.mensajero && (
                <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", propuesta.color?.fondo ?? "bg-sky-600")}>
                  {iniciales(propuesta.mensajero)}
                </span>
              )}
              <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-slate-800">
                {modo === "asignar" ? "Asignar trámite" : modo === "noDisponible" ? "No disponible" : "Reservar espacio"}
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-slate-500">{[mensajeroNombre, fechaCorta(fecha)].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <form onSubmit={guardar} className="space-y-4 px-6 py-5">
            {esTorreControl && !propuesta.tramite && (
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {MODOS.map(m => (
                  <button key={m.modo} type="button" onClick={() => setModo(m.modo)}
                    className={clsx("rounded-md px-2 py-1.5 text-xs font-semibold transition",
                      modo === m.modo ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    {m.texto}
                  </button>
                ))}
              </div>
            )}

            {!propuesta.mensajeroId && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Mensajero</span>
                <SelectBuscable value={datos.mensajeroId} onChange={cambiar("mensajeroId")} className={claseInput} aria-label="Mensajero">
                  <option value="">Seleccione…</option>
                  {mensajeros.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </SelectBuscable>
              </label>
            )}

            {modo === "asignar" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Trámite sin mensajero</span>
                {propuesta.tramite ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{resumenTramite(propuesta.tramite)}</p>
                ) : !pendientes ? (
                  <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
                ) : (
                  <SelectBuscable value={datos.tramiteAsignar} onChange={cambiar("tramiteAsignar")} className={claseInput} aria-label="Trámite">
                    <option value="">{pendientes.length ? "Seleccione…" : "No hay trámites sin mensajero"}</option>
                    {pendientes.map(t => <option key={t.id} value={t.id}>{resumenTramite(t)}</option>)}
                  </SelectBuscable>
                )}
              </label>
            )}

            {modo === "noDisponible" && (
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={datos.diaCompleto} onChange={e => setDatos(d => ({ ...d, diaCompleto: e.target.checked }))} className="rounded border-slate-300" />
                Todo el día
              </label>
            )}

            {!todoElDia && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Desde</span>
                    <select required value={datos.horaInicio} onChange={e => cambiarInicio(e.target.value)} className={claseInput}>
                      <option value="">Seleccione…</option>
                      {horas.map(h => <option key={h} value={h}>{hora12(h)}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Hasta</span>
                    <select required value={datos.horaFin} onChange={cambiar("horaFin")} className={claseInput}>
                      <option value="">Seleccione…</option>
                      {horas.filter(h => !datos.horaInicio || aMinutos(h) > aMinutos(datos.horaInicio)).map(h => <option key={h} value={h}>{hora12(h)}</option>)}
                    </select>
                  </label>
                </div>
                {datos.horaInicio && (
                  <div className="flex flex-wrap gap-1.5">
                    {DURACIONES.map(minutos => (
                      <button key={minutos} type="button" onClick={() => durar(minutos)} className={claseDuracion(minutosElegidos === minutos)}>
                        {duracionTexto(minutos)}
                      </button>
                    ))}
                    {finDelEspacio && (
                      <button type="button" onClick={() => setDatos(d => ({ ...d, horaFin: finDelEspacio }))} className={claseDuracion(datos.horaFin === finDelEspacio)}>
                        Todo el espacio
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {modo === "noDisponible" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Motivo</span>
                <select value={datos.motivoNoDisponible} onChange={cambiar("motivoNoDisponible")} className={claseInput}>
                  {[...MOTIVOS_NO_DISPONIBLE, OTRO].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            )}

            {(modo === "reserva" || (modo === "noDisponible" && datos.motivoNoDisponible === OTRO)) && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">{modo === "reserva" ? "Motivo" : "¿Cuál?"}</span>
                <input type="text" required maxLength={300} value={datos.motivo} onChange={cambiar("motivo")} className={claseInput} />
              </label>
            )}

            {modo === "reserva" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Número del trámite (opcional)</span>
                <input type="text" inputMode="numeric" value={datos.tramite} onChange={cambiar("tramite")} className={claseInput} />
              </label>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="submit" disabled={guardando} className={claseBotonPrimario}>
                {guardando ? <Loader2 size={15} className="animate-spin" />
                  : modo === "asignar" ? <UserCheck size={15} /> : modo === "noDisponible" ? <Ban size={15} /> : <CalendarPlus size={15} />}
                {modo === "asignar" ? "Asignar" : modo === "noDisponible" ? "Guardar" : "Reservar"}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
