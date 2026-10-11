"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Banknote, Loader2 } from "lucide-react"
import { pagarConCaja } from "@/actions/gastos/cajaMenor"
import { formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
const centavos = (valor: string) => Math.round(Number(valor || 0) * 100)

// Tesorería entrega el efectivo de la caja: valor entregado por gasto (precargado con el
// solicitado) y fecha. No lleva soporte: el soporte llega al legalizar.
export default function ModalPagarCaja({ bolsaId, gastos, disponible, onCerrar, onPagados }: {
  bolsaId: number
  gastos: GastoListado[]
  disponible: number
  onCerrar: () => void
  onPagados: () => void
}) {
  const [valores, setValores] = useState<Record<number, string>>(() =>
    Object.fromEntries(gastos.map(g => [g.id, String(Number(g.valorSolicitadoPago))])))
  const [fecha, setFecha] = useState(hoyEnBogota())
  const [observacion, setObservacion] = useState("")
  const [guardando, startGuardar] = useTransition()

  const total = gastos.reduce((t, g) => t + centavos(valores[g.id]), 0) / 100

  const pagar = () => {
    for (const g of gastos) if (!(Number(valores[g.id]) > 0)) return toast.error(`${g.codigo}: el valor entregado debe ser mayor a cero`)
    if (!fecha) return toast.error("Indique la fecha de entrega")
    if (total > disponible) return toast.error(`La caja no alcanza: disponible ${formatoMoneda(disponible)}`)

    startGuardar(async () => {
      const resultado = await pagarConCaja({
        bolsaId, fechaPago: fecha, observacion: observacion.trim() || null,
        gastos: gastos.map(g => ({ id: g.id, valorEntregado: Number(valores[g.id]) }))
      })
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success(gastos.length === 1 ? `${gastos[0].codigo} pagado por caja menor` : `${gastos.length} gastos pagados por caja menor`)
      onPagados()
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 pb-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">
              {gastos.length === 1 ? `Entregar efectivo · ${gastos[0].codigo}` : `Entregar efectivo de ${gastos.length} gastos`}
            </DialogTitle>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-3 font-semibold">Gasto</th>
                  <th className="py-3 pr-3 text-right font-semibold">Solicitado</th>
                  <th className="py-3 font-semibold">Valor entregado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gastos.map(g => (
                  <tr key={g.id}>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-700">{g.codigo}</p>
                      <p className="text-[11px] text-slate-400">{g.conceptoPago} · {g.beneficiario.nombre}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-right text-slate-600 whitespace-nowrap">{formatoMoneda(g.valorSolicitadoPago)}</td>
                    <td className="py-2.5">
                      <input
                        type="number" min={0} step="0.01"
                        value={valores[g.id]}
                        onChange={e => setValores(v => ({ ...v, [g.id]: e.target.value }))}
                        className={`${claseInput} w-40`}
                        aria-label={`Valor entregado de ${g.codigo}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid gap-4 py-4 sm:grid-cols-3">
              <label className="block">
                <span className={claseLabel}>Fecha de entrega</span>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} />
              </label>
              <label className="block sm:col-span-2">
                <span className={claseLabel}>Observación</span>
                <input value={observacion} onChange={e => setObservacion(e.target.value)} maxLength={1000} placeholder="Opcional" className={claseInput} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-6 pt-4">
            <p className="text-xs text-slate-500">
              Entrega <b className="text-slate-800">{formatoMoneda(total)}</b> · disponible {formatoMoneda(disponible)}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={pagar} disabled={guardando} className={claseBotonPrimario}>
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <Banknote size={15} />}
                Marcar pagado
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
