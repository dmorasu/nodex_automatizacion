"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { LoteListado } from "@/src/schemas/gastos"
import BotonEgreso from "./BotonEgreso"

// Pagos (lotes) de Contabilidad → Egresos. Cada lote se despliega con sus gastos, el beneficiario,
// su cuenta y lo pagado, para compararlo con el archivo del banco sin abrir lote por lote
export default function TablaEgresos({ registros, vacio }: { registros: LoteListado[], vacio: string }) {
  const [abiertos, setAbiertos] = useState<number[]>([])
  const todos = registros.length > 0 && abiertos.length === registros.length
  const alternar = (id: number) => setAbiertos(actual => actual.includes(id) ? actual.filter(x => x !== id) : [...actual, id])

  return (
    <div className="space-y-2">
      {registros.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setAbiertos(todos ? [] : registros.map(l => l.id))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            {todos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {todos ? "Ocultar los gastos" : "Ver los gastos de todos"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Pago</th>
              <th className="px-4 py-3 font-semibold">Fecha de pago</th>
              <th className="px-4 py-3 font-semibold">Bolsa</th>
              <th className="px-4 py-3 font-semibold text-center">Gastos</th>
              <th className="px-4 py-3 font-semibold">Pagado por</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
              <th className="px-4 py-3 font-semibold">Egreso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(lote => {
              const abierto = abiertos.includes(lote.id)
              return (
                <Fragment key={lote.id}>
                  <tr className={abierto ? "bg-slate-50" : "hover:bg-slate-50"}>
                    <td className="px-4 py-3">
                      <Link href={`/contabilidad/egresos/${lote.id}`} className="font-semibold text-emerald-700 hover:underline">Lote #{lote.id}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatoFecha(lote.fechaPago)}</td>
                    <td className="px-4 py-3 text-slate-600">{lote.bolsa.nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => alternar(lote.id)}
                        aria-expanded={abierto}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                      >
                        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {lote.cantidadGastos}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lote.creador?.nombreUsuario}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(lote.total)}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{lote.numeroEgreso ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <BotonEgreso loteId={lote.id} total={lote.total} cantidadGastos={lote.cantidadGastos} numeroActual={lote.numeroEgreso} />
                    </td>
                  </tr>

                  {abierto && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-4 pb-4 pt-0">
                        <table className="w-full rounded-md border border-slate-200 bg-white text-left text-xs">
                          <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Gasto</th>
                              <th className="px-3 py-2 font-semibold">Beneficiario</th>
                              <th className="px-3 py-2 font-semibold">Identificación</th>
                              <th className="px-3 py-2 font-semibold">Banco y cuenta</th>
                              <th className="px-3 py-2 font-semibold text-right">Valor pagado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lote.gastos.map(g => (
                              <tr key={g.id}>
                                <td className="px-3 py-2">
                                  <Link href={`/solicitudes/${g.id}`} className="font-semibold text-emerald-700 hover:underline">{g.codigo}</Link>
                                  {g.conceptoPago && <p className="max-w-xs truncate text-[11px] text-slate-400">{g.conceptoPago}</p>}
                                </td>
                                <td className="px-3 py-2 text-slate-700">{g.beneficiario?.nombre ?? "—"}</td>
                                <td className="px-3 py-2 text-slate-600">{g.beneficiario?.identificacion ?? "—"}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  {[g.beneficiario?.banco, g.beneficiario?.tipoCuenta, g.beneficiario?.numeroCuenta].filter(Boolean).join(" · ") || "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(g.valorRealmentePagado)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {registros.length === 0 && <p className="py-14 text-center text-sm text-slate-400">{vacio}</p>}
      </div>
    </div>
  )
}
