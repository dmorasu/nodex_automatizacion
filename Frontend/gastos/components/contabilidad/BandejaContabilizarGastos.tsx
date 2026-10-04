"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { BookCheck, CopyCheck, Loader2 } from "lucide-react"
import { contabilizarGastos } from "@/actions/gastos/contabilidad"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import SeleccionGastos from "../gastos/SeleccionGastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Gastos NO reembolsables legalizados con su factura: se contabilizan uno a uno o en grupo,
// cada uno con su documento contable (se puede copiar el mismo a todos)
export default function BandejaContabilizarGastos({ gastos }: { gastos: GastoListado[] }) {
  const [aContabilizar, setAContabilizar] = useState<{ gastos: GastoListado[], limpiar: () => void } | null>(null)
  const [fecha, setFecha] = useState(hoyEnBogota)
  const [documentoComun, setDocumentoComun] = useState("")
  const [documentos, setDocumentos] = useState<Record<number, string>>({})
  const [guardando, startGuardar] = useTransition()

  const seleccionados = aContabilizar?.gastos ?? []
  const faltantes = seleccionados.filter(g => !documentos[g.id]?.trim())

  const reiniciar = () => {
    setAContabilizar(null)
    setDocumentos({})
    setDocumentoComun("")
  }

  const contabilizar = () => {
    if (!fecha) return toast.error("Indique la fecha de contabilización")
    if (faltantes.length > 0) return toast.error(`Falta el documento contable de ${faltantes.map(g => g.codigo).join(", ")}`)

    startGuardar(async () => {
      const resultado = await contabilizarGastos(
        seleccionados.map(g => ({ id: g.id, documentoContable: documentos[g.id].trim() })),
        fecha
      )

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`${seleccionados.length} gasto(s) contabilizado(s)`)
      aContabilizar?.limpiar()
      reiniciar()
    })
  }

  return (
    <>
      <SeleccionGastos
        gastos={gastos}
        vacio="No hay gastos no reembolsables pendientes de contabilizar."
        valorTotal={g => Number(g.factura?.valorFactura ?? 0)}
        columnas={[
          { titulo: "Beneficiario", valor: g => g.beneficiario.nombre },
          { titulo: "Bolsa", valor: g => g.bolsa?.nombre ?? "—" },
          { titulo: "Factura", valor: g => g.factura?.numeroFactura ?? "—" },
          { titulo: "Pagado", alinearDerecha: true, valor: g => formatoMoneda(g.valorRealmentePagado) },
          { titulo: "Valor factura", alinearDerecha: true, valor: g => <b className="text-slate-800">{formatoMoneda(g.factura?.valorFactura)}</b> }
        ]}
        accion={(seleccion, limpiar) => (
          <button type="button" onClick={() => setAContabilizar({ gastos: seleccion, limpiar })} disabled={seleccion.length === 0} className={claseBotonPrimario}>
            <BookCheck size={15} />
            Contabilizar seleccionados
          </button>
        )}
      />

      <Dialog open={aContabilizar !== null} onClose={() => !guardando && reiniciar()} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-xl rounded-xl bg-white shadow-xl">
              <div className="px-6 py-4 border-b border-slate-100">
                <DialogTitle className="text-sm font-semibold text-slate-800">Contabilizar {seleccionados.length} gasto(s) no reembolsable(s)</DialogTitle>
                <p className="mt-0.5 text-xs text-slate-400">Los gastos quedan Contabilizados. Esta acción no se puede deshacer.</p>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={claseLabel}>Fecha de contabilización <span className="text-red-400">*</span></span>
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} />
                  </label>
                  <div>
                    <span className={claseLabel}>Mismo documento para todos</span>
                    <div className="flex gap-2">
                      <input value={documentoComun} onChange={e => setDocumentoComun(e.target.value)} maxLength={50} className={claseInput} />
                      <button
                        type="button"
                        onClick={() => setDocumentos(Object.fromEntries(seleccionados.map(g => [g.id, documentoComun])))}
                        disabled={!documentoComun.trim()}
                        className={`${claseBotonSecundario} shrink-0 px-3`}
                        title="Copiar a todos"
                      >
                        <CopyCheck size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Gasto</th>
                        <th className="px-3 py-2 font-semibold">Pagado el</th>
                        <th className="px-3 py-2 font-semibold text-right">Factura</th>
                        <th className="px-3 py-2 font-semibold w-44">Documento contable *</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {seleccionados.map(g => (
                        <tr key={g.id}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{g.codigo}</td>
                          <td className="px-3 py-2 text-slate-500">{formatoFecha(g.fechaPago)}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatoMoneda(g.factura?.valorFactura)}</td>
                          <td className="px-3 py-2">
                            <input
                              value={documentos[g.id] ?? ""}
                              onChange={e => setDocumentos(actuales => ({ ...actuales, [g.id]: e.target.value }))}
                              maxLength={50}
                              className={`${claseInput} h-8`}
                              aria-label={`Documento contable de ${g.codigo}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button type="button" onClick={reiniciar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
                <button type="button" onClick={contabilizar} disabled={guardando || faltantes.length > 0} className={claseBotonPrimario}>
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <BookCheck size={15} />}
                  Contabilizar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  )
}
