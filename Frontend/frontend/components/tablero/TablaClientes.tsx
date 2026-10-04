import { formatoPesos, type FilaCliente } from "@/src/tablero"

// Clientes con más trámites (abiertos + finalizados en el período) y el valor finalizado
export default function TablaClientes({ filas }: { filas: FilaCliente[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Clientes</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Los {filas.length} con más trámites. Valor: honorarios + viáticos de lo finalizado en el período. El Excel trae todos.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 text-right font-semibold">Abiertos</th>
              <th className="px-3 py-2.5 text-right font-semibold">Vencidos</th>
              <th className="px-3 py-2.5 text-right font-semibold">Finalizados</th>
              <th className="px-3 py-2.5 text-right font-semibold">A tiempo</th>
              <th className="px-5 py-2.5 text-right font-semibold">Valor finalizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(f => (
              <tr key={f.identificacion ?? f.clienteId ?? f.cliente}>
                <td className="px-5 py-2.5">
                  <p className="font-medium text-slate-700">{f.cliente}</p>
                  {f.identificacion && <p className="text-[11px] text-slate-400">{f.identificacion}</p>}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{f.abiertos}</td>
                <td className="px-3 py-2.5 text-right">{f.vencidos > 0 ? <span className="font-semibold text-red-600">{f.vencidos}</span> : <span className="text-slate-400">0</span>}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.finalizados}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{f.porcentajeATiempo === null ? "—" : `${f.porcentajeATiempo} %`}</td>
                <td className="px-5 py-2.5 text-right font-semibold text-slate-800">{f.valorFinalizado > 0 ? formatoPesos(f.valorFinalizado) : <span className="font-normal text-slate-400">—</span>}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Sin trámites con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
