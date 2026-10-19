"use client"

import { toast } from "react-toastify"
import { CheckCircle2, Paperclip, X } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"

export type GastoConSoporte = { id: number, codigo: string, detalle: string, valor: string | number | null }
export type SoportesElegidos = Record<number, File | undefined>

const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png"]
const MAX_MB = 15

// Mismo archivo (nombre, tamaño y fecha) ya elegido para otro gasto
const mismoArchivo = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

// Un soporte de pago por gasto (obligatorio y distinto en cada uno): se guarda en los documentos
// del gasto al confirmar el pago
export const faltanSoportes = (gastos: GastoConSoporte[], soportes: SoportesElegidos) =>
  gastos.filter(g => !soportes[g.id]).map(g => g.codigo)

export default function SoportesPorGasto({ gastos, soportes, onCambiar }: {
  gastos: GastoConSoporte[]
  soportes: SoportesElegidos
  onCambiar: (soportes: SoportesElegidos) => void
}) {
  const elegir = (gasto: GastoConSoporte, archivo: File | undefined) => {
    if (!archivo) return
    if (!TIPOS_ARCHIVO.includes(archivo.type)) return toast.error(`"${archivo.name}" no es PDF, JPG ni PNG`)
    if (archivo.size > MAX_MB * 1024 * 1024) return toast.error(`"${archivo.name}" pesa más de ${MAX_MB} MB`)
    const otro = gastos.find(g => g.id !== gasto.id && soportes[g.id] && mismoArchivo(soportes[g.id]!, archivo))
    if (otro) return toast.error(`Ese archivo ya es el soporte de ${otro.codigo}: cada gasto lleva su propio soporte`)
    onCambiar({ ...soportes, [gasto.id]: archivo })
  }

  const listos = gastos.filter(g => soportes[g.id]).length

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">Soporte de pago de cada gasto <span className="text-red-400">*</span></span>
        <span className={listos === gastos.length ? "font-semibold text-emerald-700" : "text-slate-400"}>{listos} de {gastos.length}</span>
      </div>
      <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-xs">
        {gastos.map(g => {
          const archivo = soportes[g.id]
          return (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-700">{g.codigo} <span className="font-normal text-slate-500">· {formatoMoneda(g.valor)}</span></p>
                <p className="truncate text-[11px] text-slate-400">{g.detalle}</p>
              </div>
              {archivo ? (
                <span className="flex min-w-0 max-w-[45%] items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span className="truncate">{archivo.name}</span>
                  <button type="button" onClick={() => onCambiar({ ...soportes, [g.id]: undefined })} className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Quitar soporte de ${g.codigo}`}>
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50">
                  <Paperclip size={13} /> Adjuntar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => { elegir(g, e.target.files?.[0]); e.target.value = "" }} />
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
