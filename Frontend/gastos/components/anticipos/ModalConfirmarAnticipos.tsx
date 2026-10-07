"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { confirmarAnticipos } from "@/actions/gastos/anticipos"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

export type AnticipoAConfirmar = {
  id: number
  codigo: string
  cliente: { nombre: string, identificacion: string }
  valorConsignado: string
}

type Fila = { valorRecibido: string, reciboCaja: string, observacion: string }

const centavos = (valor: string) => Math.round(Number(valor || 0) * 100)

// Contabilidad confirma que el dinero entró: valor real ingresado (precargado con el consignado)
// y recibo de caja de cada anticipo. Sirve para uno o para varios a la vez (todos o ninguno).
export default function ModalConfirmarAnticipos({
  anticipos,
  onCerrar,
  onConfirmados
}: {
  anticipos: AnticipoAConfirmar[]
  onCerrar: () => void
  onConfirmados?: () => void
}) {
  const [filas, setFilas] = useState<Record<number, Fila>>(() =>
    Object.fromEntries(anticipos.map(a => [a.id, { valorRecibido: String(Number(a.valorConsignado)), reciboCaja: "", observacion: "" }])))
  const [reciboComun, setReciboComun] = useState("")
  const [guardando, startGuardar] = useTransition()

  const cambiar = (id: number, campo: keyof Fila, valor: string) =>
    setFilas(actuales => ({ ...actuales, [id]: { ...actuales[id], [campo]: valor } }))

  const aplicarReciboComun = () =>
    setFilas(actuales => Object.fromEntries(Object.entries(actuales).map(([id, f]) => [id, { ...f, reciboCaja: reciboComun }])))

  const totalConsignado = anticipos.reduce((t, a) => t + centavos(a.valorConsignado), 0) / 100
  const totalRecibido = anticipos.reduce((t, a) => t + centavos(filas[a.id].valorRecibido), 0) / 100

  const confirmar = () => {
    for (const a of anticipos) {
      const fila = filas[a.id]
      if (!(Number(fila.valorRecibido) > 0)) return toast.error(`${a.codigo}: el valor real ingresado debe ser mayor a cero`)
      if (!fila.reciboCaja.trim()) return toast.error(`${a.codigo}: indique el recibo de caja`)
    }

    startGuardar(async () => {
      const resultado = await confirmarAnticipos(anticipos.map(a => ({
        id: a.id,
        valorRecibido: Number(filas[a.id].valorRecibido),
        reciboCaja: filas[a.id].reciboCaja.trim(),
        observacion: filas[a.id].observacion.trim() || null
      })))
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(anticipos.length === 1 ? `Anticipo ${anticipos[0].codigo} confirmado` : `${anticipos.length} anticipos confirmados`)
      onConfirmados?.()
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 pb-4">
            <DialogTitle className="text-sm font-semibold text-slate-800">
              {anticipos.length === 1 ? `Confirmar pago recibido · ${anticipos[0].codigo}` : `Confirmar ${anticipos.length} anticipos`}
            </DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              Verifique en el banco que el dinero entró. El valor real ingresado es lo que suma a la bolsa y al saldo del cliente;
              al confirmar se le avisa al creador para que cree el gasto.
            </p>

            {anticipos.length > 1 && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className={claseLabel}>Mismo recibo de caja para todos</span>
                  <input value={reciboComun} onChange={e => setReciboComun(e.target.value)} maxLength={50} className={`${claseInput} w-56`} />
                </label>
                <button type="button" onClick={aplicarReciboComun} disabled={!reciboComun.trim()} className={claseBotonSecundario}>Aplicar</button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-3 font-semibold">Anticipo</th>
                  <th className="py-3 pr-3 font-semibold text-right">Valor pagado</th>
                  <th className="py-3 pr-3 font-semibold">Valor real ingresado</th>
                  <th className="py-3 pr-3 font-semibold">Recibo de caja</th>
                  <th className="py-3 font-semibold">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anticipos.map(a => {
                  const fila = filas[a.id]
                  const diferencia = (centavos(fila.valorRecibido) - centavos(a.valorConsignado)) / 100
                  return (
                    <tr key={a.id} className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-700">{a.codigo}</p>
                        <p className="text-[11px] text-slate-400">{a.cliente.nombre} · {a.cliente.identificacion}</p>
                      </td>
                      <td className="py-3 pr-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatoMoneda(a.valorConsignado)}</td>
                      <td className="py-3 pr-3">
                        <input
                          type="number" min={0} step="0.01"
                          value={fila.valorRecibido}
                          onChange={e => cambiar(a.id, "valorRecibido", e.target.value)}
                          className={`${claseInput} w-36`}
                          aria-label={`Valor real ingresado de ${a.codigo}`}
                        />
                        {diferencia !== 0 && (
                          <p className={`mt-1 text-[11px] font-medium ${diferencia < 0 ? "text-red-600" : "text-amber-700"}`}>
                            Diferencia {diferencia > 0 && "+"}{formatoMoneda(diferencia)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          value={fila.reciboCaja}
                          onChange={e => cambiar(a.id, "reciboCaja", e.target.value)}
                          maxLength={50}
                          className={`${claseInput} w-36`}
                          aria-label={`Recibo de caja de ${a.codigo}`}
                        />
                      </td>
                      <td className="py-3">
                        <input
                          value={fila.observacion}
                          onChange={e => cambiar(a.id, "observacion", e.target.value)}
                          maxLength={1000}
                          placeholder={diferencia !== 0 ? "Explique la diferencia" : "Opcional"}
                          className={claseInput}
                          aria-label={`Observación de ${a.codigo}`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-6 pt-4">
            <p className="text-xs text-slate-500">
              Consignado {formatoMoneda(totalConsignado)} · ingresa <b className="text-slate-800">{formatoMoneda(totalRecibido)}</b>
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={confirmar} disabled={guardando} className={claseBotonPrimario}>
                {guardando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {anticipos.length === 1 ? "Confirmar pago recibido" : `Confirmar ${anticipos.length}`}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
