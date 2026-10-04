import Link from "next/link"
import { obtenerLotes } from "@/src/lib/datosTesoreria"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import BotonEgreso from "@/components/contabilidad/BotonEgreso"
import Paginacion from "@/components/ui/Paginacion"

const FILTROS = [
  ["pendiente", "Sin número de egreso"],
  ["registrado", "Con número de egreso"]
] as const

// Pagos de Tesorería (lotes) para registrarles el número de egreso contable
export default async function EgresosPage({ searchParams }: { searchParams: { egreso?: string, pagina?: string } }) {
  const egreso = searchParams.egreso === "registrado" ? "registrado" : "pendiente"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const { total, tamano, registros } = await obtenerLotes({ pagina, egreso })

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-xs">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/contabilidad?egreso=${codigo}`}
            className={`rounded-full border px-3 py-1 font-semibold ${egreso === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

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
            {registros.map(lote => (
              <tr key={lote.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/contabilidad/egresos/${lote.id}`} className="font-semibold text-emerald-700 hover:underline">Lote #{lote.id}</Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatoFecha(lote.fechaPago)}</td>
                <td className="px-4 py-3 text-slate-600">{lote.bolsa.nombre}</td>
                <td className="px-4 py-3 text-center text-slate-600">{lote.cantidadGastos}</td>
                <td className="px-4 py-3 text-slate-600">{lote.creador?.nombreUsuario}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatoMoneda(lote.total)}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{lote.numeroEgreso ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <BotonEgreso loteId={lote.id} total={lote.total} cantidadGastos={lote.cantidadGastos} numeroActual={lote.numeroEgreso} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {registros.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            {egreso === "pendiente" ? "Todos los pagos tienen número de egreso." : "Aún no hay pagos con número de egreso."}
          </p>
        )}
      </div>

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={p => `/contabilidad?egreso=${egreso}&pagina=${p}`} />
    </div>
  )
}
