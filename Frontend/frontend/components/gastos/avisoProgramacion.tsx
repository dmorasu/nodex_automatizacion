"use client"

import { toast } from "react-toastify"
import { CalendarClock } from "lucide-react"

// Respuesta del backend al crear el gasto: cuándo lo programa Tesorería para pago
export type ProgramacionPago = { siguienteDiaHabil: boolean, motivo?: "HORA_CORTE" | "DIA_NO_HABIL" | null, fecha: string, horaCorte: string }

// "2026-10-21" → "martes 21 de octubre"
const fechaLarga = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })

// "09:30" → "9:30 a. m."
const horaLegible = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`
}

// Aviso al guardar un gasto nuevo. Si se creó después de la hora de corte (o en un día no hábil),
// le cuenta a quien lo creó que Tesorería lo programa el siguiente día hábil; si no, el aviso normal
export const avisarGastoCreado = (codigo: string, programacion: ProgramacionPago | null | undefined) => {
  if (!programacion?.siguienteDiaHabil) {
    toast.success(`Gasto ${codigo} creado`)
    return
  }

  toast.success(
    <div className="space-y-1">
      <p className="font-semibold text-slate-800">¡Listo! El gasto {codigo} quedó guardado</p>
      <p className="text-slate-600">
        Como se registró {programacion.motivo === "DIA_NO_HABIL" ? "en un día no hábil" : `después de las ${horaLegible(programacion.horaCorte)}`}, Tesorería lo programará para pago
        el <b className="font-semibold text-sky-700">{fechaLarga(programacion.fecha)}</b>, el siguiente día hábil.
      </p>
    </div>,
    {
      autoClose: 12000,
      icon: (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-4 ring-sky-100">
          <CalendarClock size={17} strokeWidth={2.25} />
        </span>
      )
    }
  )
}
