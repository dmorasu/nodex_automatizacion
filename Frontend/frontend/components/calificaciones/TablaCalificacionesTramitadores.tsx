import Link from "next/link"
import clsx from "clsx"
import { nivel, numero, type CalificacionesPorTramitador } from "@/src/calificaciones"

// Una fila por tramitador: los de promedio más bajo primero. Las columnas P1…P5 son el promedio
// de cada pregunta (el texto completo sale al pasar el mouse por el título)
export default function TablaCalificacionesTramitadores({ datos, mes }: { datos: CalificacionesPorTramitador, mes: string }) {
  if (datos.tramitadores.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-xs text-slate-500">No hay trámites finalizados en el periodo.</p>
  }
  const enlace = (tramitadorId: number | null) =>
    `/center/calificaciones?${new URLSearchParams({ vista: "tramites", mes, tramitadorId: String(tramitadorId ?? 0) })}`

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Tramitador</th>
            <th className="px-4 py-3 text-right font-semibold">Finalizados</th>
            <th className="px-4 py-3 text-right font-semibold">Calificados</th>
            <th className="px-4 py-3 font-semibold">Promedio</th>
            <th className="px-4 py-3 text-right font-semibold">Bajas</th>
            {datos.preguntas.map((p, i) => (
              <th key={p.id} title={p.texto} className="cursor-help px-3 py-3 text-right font-semibold">P{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datos.tramitadores.map(t => (
            <tr key={t.tramitadorId ?? "sin"} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={enlace(t.tramitadorId)} className="font-semibold text-sky-700 hover:underline">{t.tramitador}</Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-600">{t.finalizados}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                {t.calificados}
                <span className="text-slate-400"> · {t.finalizados ? Math.round((t.calificados / t.finalizados) * 100) : 0} %</span>
              </td>
              <td className="px-4 py-3">
                {t.promedio === null ? <span className="text-slate-400">—</span> : (
                  <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", nivel(t.promedio).clase)}>
                    {numero(t.promedio)} · {nivel(t.promedio).nombre}
                  </span>
                )}
              </td>
              <td className={clsx("px-4 py-3 text-right tabular-nums", t.bajas ? "font-semibold text-red-600" : "text-slate-400")}>{t.bajas}</td>
              {datos.preguntas.map(p => {
                const valor = t.porPregunta[p.id]
                return (
                  <td key={p.id} className={clsx("px-3 py-3 text-right tabular-nums", valor !== null && valor !== undefined && valor < 3 ? "font-semibold text-amber-700" : "text-slate-600")}>
                    {valor === null || valor === undefined ? "—" : numero(valor)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
