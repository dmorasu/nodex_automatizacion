"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import type { ReintegrosTramitador } from "@/src/schemas/gastos"

// Mismo color que "Reintegro pendiente" en el gráfico de bolsas: el color sigue al concepto
const COLOR_PENDIENTE = "#1baf7a"
const DIA = 24 * 60 * 60 * 1000

const diasDesde = (fecha: string) => Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / DIA))

// Ranking de tramitadores por lo que deben reintegrar. La barra compara el pendiente
// entre tramitadores; al abrir una fila se ven los gastos que lo componen.
export default function ReintegrosPorTramitador({ filas }: { filas: ReintegrosTramitador[] }) {
  const [abierto, setAbierto] = useState<number | null | undefined>(undefined)

  if (filas.length === 0) {
    return <p className="rounded-md border border-slate-200 bg-white py-10 text-center text-xs text-slate-400">No hay reintegros con estos filtros.</p>
  }

  const maximo = Math.max(1, ...filas.map(f => f.pendiente))

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-xs tabular-nums">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3 font-semibold">Tramitador</th>
            <th className="px-3 py-3 font-semibold text-center">Trámites</th>
            <th className="px-3 py-3 font-semibold text-center">Gastos</th>
            <th className="px-3 py-3 font-semibold text-right">Pagado</th>
            <th className="px-3 py-3 font-semibold text-center">Con reintegro</th>
            <th className="px-3 py-3 font-semibold min-w-[220px]">Por reintegrar</th>
            <th className="px-3 py-3 font-semibold text-right">Ya reintegrado</th>
            <th className="px-3 py-3 font-semibold">Pendiente desde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map(f => {
            const expandido = abierto === f.tramitadorId
            const conDetalle = f.pendientes.length > 0
            return (
              <Fragment key={f.tramitadorId ?? "sin"}>
                <tr
                  onClick={() => conDetalle && setAbierto(expandido ? undefined : f.tramitadorId)}
                  className={conDetalle ? `cursor-pointer ${expandido ? "bg-slate-50" : "hover:bg-slate-50"}` : ""}
                >
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      <ChevronRight
                        size={14}
                        className={`shrink-0 text-slate-400 transition-transform ${expandido ? "rotate-90" : ""} ${conDetalle ? "" : "invisible"}`}
                        aria-hidden="true"
                      />
                      {f.nombre ?? <span className="italic text-slate-400">Sin tramitador</span>}
                    </span>
                    {f.identificacion && <p className="ml-5 text-[11px] text-slate-400">{f.identificacion}</p>}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">{f.tramites}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{f.gastos}</td>
                  <td className="px-3 py-3 text-right text-slate-600">{formatoMoneda(f.pagado)}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{f.gastosConReintegro}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1">
                        {f.pendiente > 0 && (
                          <div
                            className="h-full rounded-r"
                            style={{ width: `${(f.pendiente / maximo) * 100}%`, minWidth: 3, background: COLOR_PENDIENTE }}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <b className="w-28 text-right text-slate-800">{formatoMoneda(f.pendiente)}</b>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-500">{formatoMoneda(f.reintegrado)}</td>
                  <td className="px-3 py-3 text-slate-500">
                    {f.pendienteDesde ? `${formatoFecha(f.pendienteDesde)} · ${diasDesde(f.pendienteDesde)} días` : "—"}
                  </td>
                </tr>

                {expandido && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={8} className="px-3 pb-4 pt-1">
                      <table className="ml-6 w-[calc(100%-1.5rem)] rounded-md border border-slate-200 bg-white text-left">
                        <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Gasto</th>
                            <th className="px-3 py-2 font-semibold">Trámite</th>
                            <th className="px-3 py-2 font-semibold text-right">Pagado</th>
                            <th className="px-3 py-2 font-semibold text-right">Reintegro</th>
                            <th className="px-3 py-2 font-semibold">Pendiente desde</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {f.pendientes.map(p => (
                            <tr key={p.id}>
                              <td className="px-3 py-2">
                                <Link href={`/solicitudes/${p.gastoId}`} className="font-semibold text-emerald-700 hover:underline">{p.codigo}</Link>
                                <p className="text-[11px] text-slate-400">{p.concepto}</p>
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {p.tramiteId ? `#${p.tramiteId}` : "Sin trámite"}
                                {p.referencia && <p className="text-[11px] text-slate-400">{p.referencia}</p>}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600">{formatoMoneda(p.pagado)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatoMoneda(p.valor)}</td>
                              <td className="px-3 py-2 text-slate-500">{formatoFecha(p.desde)} · {diasDesde(p.desde)} días</td>
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
    </div>
  )
}
