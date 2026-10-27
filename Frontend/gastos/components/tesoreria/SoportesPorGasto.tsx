"use client"

import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCircle2, Paperclip, X } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"

export type GastoConSoporte = { id: number, codigo: string, detalle: string, valor: string | number | null }
export type SoportesElegidos = Record<number, File | undefined>

const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png"]
const MAX_MB = 15

// Mismo archivo (nombre, tamaño y fecha) ya elegido para otro gasto
const mismoArchivo = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

// Huella del contenido (como la revisa el backend): un archivo renombrado sigue siendo el mismo.
// Sin crypto.subtle (solo existe con HTTPS o en localhost) se compara nombre, tamaño y fecha
const huella = async (archivo: File) => {
  if (!globalThis.crypto?.subtle) return `${archivo.name}|${archivo.size}|${archivo.lastModified}`
  const digest = await crypto.subtle.digest("SHA-256", await archivo.arrayBuffer())
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")
}

// Gastos que comparten el mismo soporte, en grupos de códigos (vacío = todos distintos). Un solo
// pago del banco puede cubrir varios gastos: antes de enviar se le pregunta a Tesorería
export const gruposSoporteCompartido = async (gastos: GastoConSoporte[], soportes: SoportesElegidos) => {
  const porHuella = new Map<string, string[]>()
  for (const g of gastos) {
    const archivo = soportes[g.id]
    if (!archivo) continue
    const clave = await huella(archivo)
    porHuella.set(clave, [...(porHuella.get(clave) ?? []), g.codigo])
  }
  return [...porHuella.values()].filter(codigos => codigos.length > 1)
}

// Confirmación del soporte compartido (advertencia antes de pagar)
export function ConfirmarSoporteCompartido({ grupos, onAceptar, onCancelar }: {
  grupos: string[][]
  onAceptar: () => void
  onCancelar: () => void
}) {
  return (
    <Dialog open onClose={onCancelar} className="relative z-[60]">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <DialogTitle className="text-sm font-semibold text-slate-800">Mismo soporte en varios gastos</DialogTitle>
          <p className="mt-2 text-xs text-slate-500">¿Un solo pago del banco cubre estos gastos? Cada uno queda con una copia del soporte.</p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {grupos.map(codigos => (
              <li key={codigos.join()} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                {codigos.join(", ")}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onCancelar} className={claseBotonSecundario}>Cambiar soportes</button>
            <button type="button" onClick={onAceptar} className={claseBotonPrimario}>Sí, cubre esos gastos</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

// Un soporte de pago por gasto (obligatorio): se guarda en los documentos del gasto al confirmar
// el pago. Si es el mismo archivo en varios gastos se pide confirmación antes de enviar
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
          // Mismo archivo que otro gasto: se acepta y se confirma al enviar
          const compartidoCon = archivo ? gastos.filter(o => o.id !== g.id && soportes[o.id] && mismoArchivo(soportes[o.id]!, archivo)).map(o => o.codigo) : []
          return (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-700">{g.codigo} <span className="font-normal text-slate-500">· {formatoMoneda(g.valor)}</span></p>
                <p className="truncate text-[11px] text-slate-400">{g.detalle}</p>
                {compartidoCon.length > 0 && <p className="text-[11px] font-medium text-amber-700">Mismo soporte que {compartidoCon.join(", ")}</p>}
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
