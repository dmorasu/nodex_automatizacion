"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { BookCheck, CopyCheck, Loader2 } from "lucide-react"
import { contabilizarCuentas } from "@/actions/gastos/contabilidad"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { CuentaListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Cuentas de cobro legalizadas, con selección para contabilizarlas de una vez.
// Cada cuenta lleva su documento contable (se puede copiar el mismo a todas).
export default function BandejaContabilizar({ cuentas }: { cuentas: CuentaListado[] }) {
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyEnBogota)
  const [documentoComun, setDocumentoComun] = useState("")
  const [documentos, setDocumentos] = useState<Record<number, string>>({})
  const [guardando, startGuardar] = useTransition()

  const seleccionadas = useMemo(() => cuentas.filter(c => seleccion.has(c.id)), [cuentas, seleccion])
  const total = seleccionadas.reduce((suma, c) => suma + Number(c.totalLegalizado), 0)
  const todasMarcadas = cuentas.length > 0 && seleccionadas.length === cuentas.length

  const alternar = (id: number) =>
    setSeleccion(actual => {
      const nueva = new Set(actual)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })

  const copiarATodas = () =>
    setDocumentos(Object.fromEntries(seleccionadas.map(c => [c.id, documentoComun])))

  const faltantes = seleccionadas.filter(c => !documentos[c.id]?.trim())

  const contabilizar = () => {
    if (!fecha) return toast.error("Indique la fecha de contabilización")
    if (faltantes.length > 0) return toast.error(`Falta el documento contable de ${faltantes.map(c => c.numeroCuentaCobro).join(", ")}`)

    startGuardar(async () => {
      const resultado = await contabilizarCuentas(
        seleccionadas.map(c => ({ id: c.id, documentoContable: documentos[c.id].trim() })),
        fecha
      )

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`${seleccionadas.length} cuenta(s) contabilizada(s)`)
      setAbierto(false)
      setSeleccion(new Set())
      setDocumentos({})
      setDocumentoComun("")
    })
  }

  return (
    <div className="space-y-3">

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-slate-600">
          {seleccionadas.length === 0
            ? "Seleccione las cuentas de cobro que va a contabilizar"
            : <><b>{seleccionadas.length}</b> seleccionada(s) · total legalizado <b>{formatoMoneda(total)}</b></>}
        </p>
        <button type="button" onClick={() => setAbierto(true)} disabled={seleccionadas.length === 0} className={claseBotonPrimario}>
          <BookCheck size={15} />
          Contabilizar seleccionadas
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={todasMarcadas}
                  onChange={() => setSeleccion(todasMarcadas ? new Set() : new Set(cuentas.map(c => c.id)))}
                  className="h-4 w-4 accent-emerald-600"
                  aria-label="Seleccionar todas"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Cuenta de cobro</th>
              <th className="px-4 py-3 font-semibold">Radicación</th>
              <th className="px-4 py-3 font-semibold">Legalizada</th>
              <th className="px-4 py-3 font-semibold text-center">Gastos</th>
              <th className="px-4 py-3 font-semibold text-right">Facturas</th>
              <th className="px-4 py-3 font-semibold text-right">4x1000</th>
              <th className="px-4 py-3 font-semibold text-right">Total legalizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cuentas.map(cuenta => (
              <tr
                key={cuenta.id}
                onClick={() => alternar(cuenta.id)}
                className={`cursor-pointer ${seleccion.has(cuenta.id) ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seleccion.has(cuenta.id)}
                    onChange={() => alternar(cuenta.id)}
                    onClick={e => e.stopPropagation()}
                    className="h-4 w-4 accent-emerald-600"
                    aria-label={`Seleccionar ${cuenta.numeroCuentaCobro}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/contabilidad/cuentas/${cuenta.id}`} onClick={e => e.stopPropagation()} className="font-semibold text-emerald-700 hover:underline">
                    {cuenta.numeroCuentaCobro}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatoFecha(cuenta.fechaRadicacion)}</td>
                <td className="px-4 py-3 text-slate-500">{formatoFecha(cuenta.fechaLegalizacion)}</td>
                <td className="px-4 py-3 text-center text-slate-600">{cuenta.cantidadGastos}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatoMoneda(cuenta.totalFacturas)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{formatoMoneda(cuenta.totalCuatroXMil)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(cuenta.totalLegalizado)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {cuentas.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">No hay cuentas de cobro legalizadas pendientes de contabilizar.</p>
        )}
      </div>

      <Dialog open={abierto} onClose={() => !guardando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-xl rounded-xl bg-white shadow-xl">
              <div className="px-6 py-4 border-b border-slate-100">
                <DialogTitle className="text-sm font-semibold text-slate-800">Contabilizar {seleccionadas.length} cuenta(s) de cobro</DialogTitle>
                <p className="mt-0.5 text-xs text-slate-400">
                  Las cuentas y sus gastos quedan Contabilizados. Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={claseLabel}>Fecha de contabilización <span className="text-red-400">*</span></span>
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} />
                  </label>
                  <div>
                    <span className={claseLabel}>Mismo documento para todas</span>
                    <div className="flex gap-2">
                      <input value={documentoComun} onChange={e => setDocumentoComun(e.target.value)} maxLength={50} className={claseInput} />
                      <button type="button" onClick={copiarATodas} disabled={!documentoComun.trim()} className={`${claseBotonSecundario} shrink-0 px-3`} title="Copiar a todas">
                        <CopyCheck size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Cuenta</th>
                        <th className="px-3 py-2 font-semibold text-right">Legalizado</th>
                        <th className="px-3 py-2 font-semibold w-48">Documento contable *</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {seleccionadas.map(cuenta => (
                        <tr key={cuenta.id}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{cuenta.numeroCuentaCobro}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatoMoneda(cuenta.totalLegalizado)}</td>
                          <td className="px-3 py-2">
                            <input
                              value={documentos[cuenta.id] ?? ""}
                              onChange={e => setDocumentos(actuales => ({ ...actuales, [cuenta.id]: e.target.value }))}
                              maxLength={50}
                              className={`${claseInput} h-8`}
                              aria-label={`Documento contable de ${cuenta.numeroCuentaCobro}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button type="button" onClick={() => setAbierto(false)} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
                <button type="button" onClick={contabilizar} disabled={guardando || faltantes.length > 0} className={claseBotonPrimario}>
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <BookCheck size={15} />}
                  Contabilizar
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
