import { AlertTriangle } from "lucide-react"
import { miles, type FilaAnalista } from "@/src/tablero"

// Carga y desempeño por analista. La barra muestra los abiertos frente al analista con más carga.
export default function TablaAnalistas({ filas }: { filas: FilaAnalista[] }) {
  const maximo = Math.max(1, ...filas.map(f => f.abiertos))

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Carga y desempeño por analista</h2>
        <p className="mt-0.5 text-xs text-slate-400">Abiertos, vencidos y novedades de hoy; finalizados, % a tiempo, ciclo y programación en plazo en el período.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Analista</th>
              <th className="px-3 py-2.5 font-semibold">Abiertos</th>
              <th className="px-3 py-2.5 text-right font-semibold">Vencidos</th>
              <th className="px-3 py-2.5 text-right font-semibold">En novedad</th>
              <th className="px-3 py-2.5 text-right font-semibold">Finalizados</th>
              <th className="px-3 py-2.5 text-right font-semibold">A tiempo</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ciclo prom.</th>
              <th className="px-5 py-2.5 text-right font-semibold" title="Creados en el período que se programaron a más tardar el día hábil siguiente a su creación">Programación en plazo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(f => (
              <tr key={f.analistaId ?? "sin"}>
                <td className="px-5 py-2.5 font-medium text-slate-700">{f.analista}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[#0284c7]" style={{ width: `${(f.abiertos / maximo) * 100}%` }} />
                    </span>
                    <span className="font-semibold text-slate-700">{miles(f.abiertos)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {f.vencidos > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {miles(f.vencidos)}
                    </span>
                  ) : <span className="text-slate-400">0</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700">{miles(f.enNovedad)}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{miles(f.finalizados)}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.porcentajeATiempo === null ? "—" : `${f.porcentajeATiempo} %`}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.cicloPromedioDias === null ? "—" : `${f.cicloPromedioDias} d`}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">
                  {f.porcentajeProgramacionEnPlazo === null ? "—" : (
                    <>
                      <span className="font-semibold">{f.porcentajeProgramacionEnPlazo} %</span>
                      <span className="ml-1.5 text-[11px] text-slate-400">{miles(f.programacionEnPlazo)}/{miles(f.programacionEvaluados)}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">Sin trámites con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
