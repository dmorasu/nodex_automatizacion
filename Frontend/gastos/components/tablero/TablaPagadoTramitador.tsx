"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { PagadoTramitador } from "@/src/schemas/gastos"

// Mismo color que "Sin factura" en el gráfico de bolsas: es el dinero que aún no se ha soportado
const COLOR_POR_JUSTIFICAR = "#2a78d6"

const VALOR = "px-3 py-3 text-right"
const VALOR_DETALLE = "px-3 py-2 text-right"

// Una fila por tramitador con lo pagado y en qué va ese dinero; la barra compara lo que cada uno
// tiene por justificar. Al abrir la fila se ven sus gastos con el trámite y el estado del trámite.
export default function TablaPagadoTramitador({ filas }: { filas: PagadoTramitador[] }) {
  const [abierto, setAbierto] = useState<number | null | undefined>(undefined)

  if (filas.length === 0) {
    return <p className="rounded-md border border-slate-200 bg-white py-10 text-center text-xs text-slate-400">No hay gastos pagados con estos filtros.</p>
  }

  const maximo = Math.max(1, ...filas.map(f => f.porJustificar))

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs tabular-nums">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3 font-semibold">Tramitador</th>
            <th className="px-3 py-3 font-semibold text-center">Trámites</th>
            <th className="px-3 py-3 font-semibold text-center">Gastos</th>
            <th className={`${VALOR} font-semibold`}>Pagado</th>
            <th className={`${VALOR} font-semibold`}>Facturado</th>
            <th className={`${VALOR} font-semibold`}>Reintegrado</th>
            <th className={`${VALOR} font-semibold`}>Reintegro pendiente</th>
            <th className="px-3 py-3 font-semibold min-w-[220px]">Por justificar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map(f => {
            const expandido = abierto === f.tramitadorId
            return (
              <Fragment key={f.tramitadorId ?? "sin"}>
                <tr onClick={() => setAbierto(expandido ? undefined : f.tramitadorId)} className={`cursor-pointer ${expandido ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform ${expandido ? "rotate-90" : ""}`} aria-hidden="true" />
                      {f.nombre ?? <span className="italic text-slate-400">Sin tramitador</span>}
                    </span>
                    {f.identificacion && <p className="ml-5 text-[11px] text-slate-400">{f.identificacion}</p>}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">{f.tramites}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{f.gastos}</td>
                  <td className={`${VALOR} text-slate-700`}>{formatoMoneda(f.pagado)}</td>
                  <td className={`${VALOR} text-slate-600`}>{formatoMoneda(f.facturado)}</td>
                  <td className={`${VALOR} text-slate-600`}>{formatoMoneda(f.reintegrado)}</td>
                  <td className={`${VALOR} text-slate-600`}>{formatoMoneda(f.reintegroPendiente)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1">
                        {f.porJustificar > 0 && (
                          <div className="h-full rounded-r" style={{ width: `${(f.porJustificar / maximo) * 100}%`, minWidth: 3, background: COLOR_POR_JUSTIFICAR }} aria-hidden="true" />
                        )}
                      </div>
                      <b className="w-28 text-right text-slate-800">{formatoMoneda(f.porJustificar)}</b>
                    </div>
                  </td>
                </tr>

                {expandido && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={8} className="px-3 pb-4 pt-1">
                      <div className="ml-6 overflow-x-auto rounded-md border border-slate-200 bg-white">
                        <table className="w-full text-left">
                          <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Trámite</th>
                              <th className="px-3 py-2 font-semibold">Estado del trámite</th>
                              <th className="px-3 py-2 font-semibold">Gasto</th>
                              <th className="px-3 py-2 font-semibold">Pago</th>
                              <th className={`${VALOR_DETALLE} font-semibold`}>Pagado</th>
                              <th className={`${VALOR_DETALLE} font-semibold`}>Facturado</th>
                              <th className={`${VALOR_DETALLE} font-semibold`}>Reintegrado</th>
                              <th className={`${VALOR_DETALLE} font-semibold`}>Reintegro pendiente</th>
                              <th className={`${VALOR_DETALLE} font-semibold`}>Por justificar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {f.detalle.map(g => (
                              <tr key={g.gastoId}>
                                <td className="px-3 py-2 text-slate-600">
                                  {g.tramiteId ? <b className="text-slate-700">#{g.tramiteId}</b> : <span className="italic text-slate-400">Sin trámite</span>}
                                  {g.tipoTramite && <p className="text-[11px] text-slate-400">{g.tipoTramite}</p>}
                                  {g.referencia && <p className="text-[11px] text-slate-400">{g.referencia}</p>}
                                </td>
                                <td className="px-3 py-2 text-slate-600">{g.estadoTramite ?? "—"}</td>
                                <td className="px-3 py-2">
                                  <Link href={`/solicitudes/${g.gastoId}`} className="font-semibold text-emerald-700 hover:underline">{g.codigo}</Link>
                                  <p className="text-[11px] text-slate-400">{g.estadoGasto}{g.factura ? ` · factura ${g.factura}` : ""}</p>
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                  {formatoFecha(g.fechaPago)}
                                  {g.bolsa && <p className="text-[11px] text-slate-400">{g.bolsa}</p>}
                                </td>
                                <td className={`${VALOR_DETALLE} text-slate-700`}>{formatoMoneda(g.pagado)}</td>
                                <td className={`${VALOR_DETALLE} text-slate-600`}>{formatoMoneda(g.facturado)}</td>
                                <td className={`${VALOR_DETALLE} text-slate-600`}>{formatoMoneda(g.reintegrado)}</td>
                                <td className={`${VALOR_DETALLE} text-slate-600`}>{formatoMoneda(g.reintegroPendiente)}</td>
                                <td className={`${VALOR_DETALLE} font-semibold text-slate-800`}>{formatoMoneda(g.porJustificar)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
