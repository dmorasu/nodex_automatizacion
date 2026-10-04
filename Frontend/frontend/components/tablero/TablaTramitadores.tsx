import { AlertTriangle } from "lucide-react"
import { formatoPesos, type FilaTramitador } from "@/src/tablero"

// Desempeño por tramitador, con lo que debe de reintegros en Nodex Gastos
export default function TablaTramitadores({ filas, reintegrosDisponibles }: { filas: FilaTramitador[], reintegrosDisponibles: boolean }) {
  const maximo = Math.max(1, ...filas.map(f => f.abiertos))

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Desempeño por tramitador</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Abiertos, vencidos y novedades a hoy; finalizados y % a tiempo en el período.
          {reintegrosDisponibles
            ? " Reintegro pendiente: lo que debe devolver en Nodex Gastos (todos sus gastos, no solo los de este filtro)."
            : " No se pudieron leer los reintegros de Nodex Gastos."}
        </p>
      </div>

      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Tramitador</th>
              <th className="px-3 py-2.5 font-semibold">Abiertos</th>
              <th className="px-3 py-2.5 text-right font-semibold">Vencidos</th>
              <th className="px-3 py-2.5 text-right font-semibold">En novedad</th>
              <th className="px-3 py-2.5 text-right font-semibold">Finalizados</th>
              <th className="px-3 py-2.5 text-right font-semibold">A tiempo</th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Reportados como realizados en la app y aún abiertos">Realizado sin finalizar</th>
              <th className="px-5 py-2.5 text-right font-semibold">Reintegro pendiente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(f => (
              <tr key={f.tramitadorId ?? "sin"}>
                <td className="px-5 py-2.5 font-medium text-slate-700">{f.tramitador}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[#0284c7]" style={{ width: `${(f.abiertos / maximo) * 100}%` }} />
                    </span>
                    <span className="font-semibold text-slate-700">{f.abiertos}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {f.vencidos > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                      <AlertTriangle size={12} aria-hidden="true" />{f.vencidos}
                    </span>
                  ) : <span className="text-slate-400">0</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.enNovedad}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.finalizados}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.porcentajeATiempo === null ? "—" : `${f.porcentajeATiempo} %`}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.realizadoSinFinalizar || <span className="text-slate-400">0</span>}</td>
                <td className="px-5 py-2.5 text-right">
                  {f.reintegroPendiente > 0 ? (
                    <span className="font-semibold text-slate-800">
                      {formatoPesos(f.reintegroPendiente)}
                      <span className="block text-[10px] font-normal text-slate-400">{f.gastosConReintegro} gasto(s)</span>
                    </span>
                  ) : <span className="text-slate-400">—</span>}
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
