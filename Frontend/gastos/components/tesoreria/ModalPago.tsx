"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { AlertTriangle, Loader2, Wallet } from "lucide-react"
import { pagarGastos } from "@/actions/gastos/tesoreria"
import { formatoMoneda } from "@/src/lib/formato"
import type { Bolsa, GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

const aCentavos = (valor: string | number) => Math.round(Number(valor) * 100)

export default function ModalPago({
  gastos,
  bolsas,
  onCerrar,
  onPagado
}: {
  gastos: GastoListado[]
  bolsas: Bolsa[]
  onCerrar: () => void
  onPagado: () => void
}) {
  // Si todos los gastos son de la misma bolsa, se propone esa
  const bolsasDeGastos = new Set(gastos.map(g => g.bolsa?.id))
  const bolsaComun = bolsasDeGastos.size === 1 ? [...bolsasDeGastos][0] ?? null : null

  const [bolsaId, setBolsaId] = useState<number | null>(bolsaComun)
  const [fechaPago, setFechaPago] = useState(hoyEnBogota)
  const [observacion, setObservacion] = useState("")
  const [archivos, setArchivos] = useState<File[]>([])
  // Valor pagado por gasto; por defecto el valor solicitado (se puede cambiar)
  const [valores, setValores] = useState<Record<number, string>>(
    () => Object.fromEntries(gastos.map(g => [g.id, String(Number(g.valorSolicitadoPago))]))
  )
  const [pagando, startPagar] = useTransition()

  const bolsa = bolsas.find(b => b.id === bolsaId)
  const totalCentavos = useMemo(
    () => gastos.reduce((suma, g) => suma + aCentavos(valores[g.id] || 0), 0),
    [gastos, valores]
  )
  const saldoDespues = bolsa ? (aCentavos(bolsa.saldoActual) - totalCentavos) / 100 : null
  const saldoInsuficiente = saldoDespues !== null && saldoDespues < 0
  const valoresInvalidos = gastos.some(g => !(Number(valores[g.id]) > 0))
  const cambianDeBolsa = bolsaId ? gastos.filter(g => g.bolsa?.id !== bolsaId) : []

  const pagar = () => {
    if (!bolsaId) return toast.error("Seleccione la bolsa")
    if (!fechaPago) return toast.error("Indique la fecha de pago")
    if (valoresInvalidos) return toast.error("Todos los valores pagados deben ser mayores a cero")

    let soporte: FormData | null = null
    if (archivos.length > 0) {
      soporte = new FormData()
      archivos.forEach(archivo => soporte!.append("archivos", archivo))
    }

    startPagar(async () => {
      const resultado = await pagarGastos({
        bolsaId,
        fechaPago,
        observacion,
        gastos: gastos.map(g => ({ id: g.id, valorRealmentePagado: Number(valores[g.id]) }))
      }, soporte)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`${gastos.length} gasto(s) pagado(s) · lote #${resultado.datos.loteId}`)
      if (resultado.advertencia) toast.warning(resultado.advertencia, { autoClose: false })
      onPagado()
    })
  }

  return (
    <Dialog open onClose={() => !pagando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-3xl rounded-xl bg-white shadow-xl">

            <div className="px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-sm font-semibold text-slate-800">
                Pagar {gastos.length} gasto(s)
              </DialogTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                Se crea un lote de pago, se descuenta la bolsa y se avisa por correo a quien creó cada gasto.
              </p>
            </div>

            <div className="px-6 py-5 space-y-5">

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={claseLabel}>Bolsa <span className="text-red-400">*</span></span>
                  <select
                    value={bolsaId ?? ""}
                    onChange={e => setBolsaId(e.target.value ? Number(e.target.value) : null)}
                    className={claseInput}
                  >
                    <option value="">Seleccione</option>
                    {bolsas.map(b => (
                      <option key={b.id} value={b.id}>{b.nombre} · {formatoMoneda(b.saldoActual)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={claseLabel}>Fecha de pago <span className="text-red-400">*</span></span>
                  <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className={claseInput} />
                </label>
              </div>

              {cambianDeBolsa.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p>
                    {cambianDeBolsa.map(g => g.codigo).join(", ")} {cambianDeBolsa.length === 1 ? "está asociado" : "están asociados"} a
                    otra bolsa y {cambianDeBolsa.length === 1 ? "quedará" : "quedarán"} en <b>{bolsa?.nombre}</b> al pagar.
                  </p>
                </div>
              )}

              {/* Valores por gasto */}
              <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Gasto</th>
                      <th className="px-3 py-2 font-semibold">Beneficiario</th>
                      <th className="px-3 py-2 font-semibold text-right">Valor solicitado</th>
                      <th className="px-3 py-2 font-semibold text-right w-40">Valor pagado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gastos.map(g => (
                      <tr key={g.id}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-700">{g.codigo}</p>
                          <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{g.conceptoPago}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{g.beneficiario.nombre}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatoMoneda(g.valorSolicitadoPago)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={valores[g.id]}
                            onChange={e => setValores(actuales => ({ ...actuales, [g.id]: e.target.value }))}
                            className={`${claseInput} h-8 text-right`}
                            aria-label={`Valor pagado ${g.codigo}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen */}
              <div className="grid gap-3 sm:grid-cols-3 rounded-md bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Total del pago</p>
                  <p className="text-base font-semibold text-slate-800">{formatoMoneda(totalCentavos / 100)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Saldo de la bolsa</p>
                  <p className="text-sm text-slate-700">{formatoMoneda(bolsa?.saldoActual)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Saldo después del pago</p>
                  <p className={`text-sm font-semibold ${saldoInsuficiente ? "text-red-600" : "text-slate-700"}`}>
                    {formatoMoneda(saldoDespues)}
                  </p>
                </div>
              </div>

              {saldoInsuficiente && (
                <p className="text-xs text-red-600">
                  La bolsa no tiene saldo suficiente. Recárguela en la pestaña Bolsas o reduzca la selección.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={claseLabel}>Soporte de pago (PDF, JPG o PNG)</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setArchivos(Array.from(e.target.files ?? []))}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
                  />
                </label>
                <label className="block">
                  <span className={claseLabel}>Observación</span>
                  <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={2} maxLength={1000} className={claseTextarea} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={onCerrar} disabled={pagando} className={claseBotonSecundario}>Cancelar</button>
              <button
                type="button"
                onClick={pagar}
                disabled={pagando || !bolsaId || saldoInsuficiente || valoresInvalidos}
                className={claseBotonPrimario}
              >
                {pagando ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                Confirmar pago de {formatoMoneda(totalCentavos / 100)}
              </button>
            </div>

          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
