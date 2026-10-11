import Link from "next/link"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import { ESTADOS_REEMBOLSO, type ReembolsoListado } from "@/src/schemas/gastos"
import EstadoGasto from "../gastos/EstadoGasto"

// Reembolsos de caja menor; `base` es la ruta del detalle (Tesorería o Dirección)
export default function TablaReembolsos({ reembolsos, base, vacio }: { reembolsos: ReembolsoListado[], base: string, vacio: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Reembolso</th>
            <th className="px-4 py-3 font-semibold">Caja</th>
            <th className="px-4 py-3 font-semibold">Gastos</th>
            <th className="px-4 py-3 font-semibold">Fechas</th>
            <th className="px-4 py-3 text-right font-semibold">Total</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reembolsos.map(r => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`${base}/${r.id}`} className="font-semibold text-emerald-700 hover:underline">{r.codigo}</Link>
                <p className="text-[11px] text-slate-400">{r.creador?.nombreUsuario}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{r.bolsa.nombre}</td>
              <td className="px-4 py-3 text-slate-600">{r.cantidadGastos}</td>
              <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                <p>Creado {formatoFecha(r.createdAt.slice(0, 10))}</p>
                {r.fechaAprobacion && <p>Aprobado {formatoFecha(r.fechaAprobacion.slice(0, 10))}</p>}
                {r.fechaLegalizacion && <p>Legalizado {formatoFecha(r.fechaLegalizacion)}</p>}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(r.total)}</td>
              <td className="px-4 py-3">
                <EstadoGasto codigo={r.estado} nombre={ESTADOS_REEMBOLSO[r.estado] ?? r.estado} />
                {r.estado === "BORRADOR" && r.motivoRechazo && <p className="mt-1 max-w-[220px] text-[11px] text-red-600">Devuelto: {r.motivoRechazo}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reembolsos.length === 0 && <p className="py-14 text-center text-sm text-slate-400">{vacio}</p>}
    </div>
  )
}
