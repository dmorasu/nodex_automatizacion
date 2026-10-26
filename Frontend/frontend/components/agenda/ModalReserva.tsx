"use client"

import { useState } from "react"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CalendarPlus, Loader2, X } from "lucide-react"
import { toast } from "react-toastify"
import { llamarApi } from "@/src/lib/apiCliente"
import { aHora, aMinutos, fechaCorta } from "@/src/agenda"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"

export type ReservaPropuesta = { mensajeroId: number, mensajero: string, inicio?: string, fin?: string }

// Aparta un espacio en la agenda del mensajero. Si viene de un espacio libre, propone su inicio
// y una hora (o lo que quede del espacio)
export default function ModalReserva({ fecha, propuesta, onCerrar, onReservada }: {
  fecha: string
  propuesta: ReservaPropuesta
  onCerrar: () => void
  onReservada: () => void
}) {
  const inicioPropuesto = propuesta.inicio ?? ""
  const finPropuesto = propuesta.inicio && propuesta.fin
    ? aHora(Math.min(aMinutos(propuesta.inicio) + 60, aMinutos(propuesta.fin)))
    : ""
  const [datos, setDatos] = useState({ horaInicio: inicioPropuesto, horaFin: finPropuesto, motivo: "", tramite: "" })
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) => setDatos(d => ({ ...d, [campo]: e.target.value }))
  const horasValidas = Boolean(datos.horaInicio && datos.horaFin && datos.horaFin > datos.horaInicio)

  const reservar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!horasValidas) return toast.error("La hora final debe ser posterior a la hora de inicio")
    if (!datos.motivo.trim()) return toast.error("Indique el motivo de la reserva")
    setGuardando(true)
    const r = await llamarApi<{ id: number }>("/agenda-mensajeros/reservas", "POST", {
      tramitadorId: propuesta.mensajeroId,
      fecha,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      motivo: datos.motivo.trim(),
      solicitudTramiteId: datos.tramite.replace(/\D/g, "") || null
    })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success("Espacio reservado")
    onReservada()
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-slate-800">Reservar espacio</DialogTitle>
              <p className="mt-0.5 truncate text-xs text-slate-500">{propuesta.mensajero} · {fechaCorta(fecha)}</p>
            </div>
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <form onSubmit={reservar} className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Desde</span>
                <input type="time" required value={datos.horaInicio} onChange={cambiar("horaInicio")} className={claseInput} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Hasta</span>
                <input type="time" required value={datos.horaFin} onChange={cambiar("horaFin")} className={claseInput} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Motivo</span>
              <input type="text" required maxLength={300} value={datos.motivo} onChange={cambiar("motivo")} className={claseInput} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Número del trámite (opcional)</span>
              <input type="text" inputMode="numeric" value={datos.tramite} onChange={cambiar("tramite")} className={claseInput} />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="submit" disabled={guardando} className={claseBotonPrimario}>
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />}
                Reservar
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
