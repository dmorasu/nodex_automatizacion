"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { fechaCorta, miles, type Tablero } from "@/src/tablero"

// Pesos sin toLocaleString: Node y el navegador formatean distinto y React da error de hidratación
const pesos = (valor: number) => `$ ${miles(Math.round(valor))}`

const claseFecha = "h-8 w-[8.5rem] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

// Valor del trámite (sin viáticos) por operación. Acumulado de todos los trámites, sin el período
// del tablero (sí con los demás filtros); la ficha tiene su propio rango de creación opcional,
// que viaja en la URL (valorDesde / valorHasta). La barra compara con la operación de mayor valor.
export default function TablaOperaciones({ datos, hoy }: { datos: Tablero["valorPorOperacion"], hoy: string }) {
  const router = useRouter()
  const parametros = useSearchParams()
  const { filas, total, desde, hasta } = datos

  const maximo = Math.max(1, ...filas.map(f => f.valorTotal))
  const tramites = filas.reduce((suma, f) => suma + f.tramites, 0)
  const conValor = filas.reduce((suma, f) => suma + f.conValor, 0)

  const cambiarRango = (cambios: { valorDesde?: string, valorHasta?: string }) => {
    const nuevos = new URLSearchParams(parametros.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor)
      else nuevos.delete(clave)
    }
    router.push(`/center/torreControl?${nuevos}`, { scroll: false })
  }

  const rango = desde && hasta ? `Creados del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`
    : desde ? `Creados desde el ${fechaCorta(desde)}`
      : hasta ? `Creados hasta el ${fechaCorta(hasta)}`
        : "Acumulado de todos los trámites"

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-700">Valor por operación</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {rango} · {pesos(total)} en valor del trámite
            {conValor < tramites && ` · ${miles(tramites - conValor)} sin valor registrado`}
          </p>
        </div>

        {/* Rango propio de esta ficha (no usa el período del tablero) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="date" value={desde ?? ""} max={hasta ?? hoy} onChange={e => cambiarRango({ valorDesde: e.target.value })} className={claseFecha} aria-label="Valor por operación: creados desde" />
          <span className="text-xs text-slate-400">a</span>
          <input type="date" value={hasta ?? ""} min={desde ?? undefined} max={hoy} onChange={e => cambiarRango({ valorHasta: e.target.value })} className={claseFecha} aria-label="Valor por operación: creados hasta" />
          {(desde || hasta) && (
            <button type="button" onClick={() => cambiarRango({ valorDesde: "", valorHasta: "" })} className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Todo
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Operación</th>
              <th className="px-3 py-2.5 text-right font-semibold">Trámites</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor total</th>
              <th className="px-5 py-2.5 font-semibold">% del total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(f => (
              <tr key={f.operacionId ?? "sin"}>
                <td className="px-5 py-2.5 font-medium text-slate-700">{f.operacion}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">
                  {miles(f.tramites)}
                  {f.conValor < f.tramites && (
                    <span className="block text-[11px] text-slate-400" title="Trámites sin valor del trámite en la programación">{miles(f.tramites - f.conValor)} sin valor</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-800">
                  {f.valorTotal > 0 ? pesos(f.valorTotal) : <span className="font-normal text-slate-400">—</span>}
                </td>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-sky-600" style={{ width: `${(f.valorTotal / maximo) * 100}%` }} />
                    </span>
                    <span className="whitespace-nowrap text-slate-600">{f.porcentaje} %</span>
                  </div>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Sin trámites con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
