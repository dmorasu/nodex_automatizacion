import Link from "next/link"
import { obtenerReintegros } from "@/src/lib/datosLegalizacion"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"
import EstadoGasto from "@/components/gastos/EstadoGasto"
import { BotonMarcarReintegrado } from "@/components/legalizacion/BotonReintegro"
import Paginacion from "@/components/ui/Paginacion"

export default async function ReintegrosPage({ searchParams }: { searchParams: { estado?: string, pagina?: string } }) {
  // Por defecto se muestran los pendientes: es lo que hay que gestionar
  const estado = searchParams.estado === "TODOS" ? undefined : (searchParams.estado ?? "PENDIENTE")
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const { total, tamano, registros } = await obtenerReintegros(estado, pagina)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-xs">
        {[["PENDIENTE", "Pendientes"], ["REINTEGRADO", "Reintegrados"], ["TODOS", "Todos"]].map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/legalizacion/reintegros?estado=${codigo}`}
            className={`rounded-full border px-3 py-1 font-semibold ${(estado ?? "TODOS") === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Gasto</th>
              <th className="px-4 py-3 font-semibold">Tramitador</th>
              <th className="px-4 py-3 font-semibold">Registrado</th>
              <th className="px-4 py-3 font-semibold text-right">Pagado</th>
              <th className="px-4 py-3 font-semibold text-right">Reintegro</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(reintegro => (
              <tr key={reintegro.id}>
                <td className="px-4 py-3">
                  <Link href={`/solicitudes/${reintegro.solicitudGasto.id}`} className="font-semibold text-emerald-700 hover:underline">
                    {reintegro.solicitudGasto.codigo}
                  </Link>
                  <p className="text-[11px] text-slate-400">{reintegro.observacion ?? reintegro.solicitudGasto.conceptoPago}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{reintegro.solicitudGasto.tramitador?.nombreTramitador ?? reintegro.solicitudGasto.beneficiario.nombre}</td>
                <td className="px-4 py-3 text-slate-500">
                  {formatoFecha(reintegro.createdAt)}
                  <p className="text-[11px]">{reintegro.registrador?.nombreUsuario}</p>
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{formatoMoneda(reintegro.solicitudGasto.valorRealmentePagado)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatoMoneda(reintegro.valorReintegro)}</td>
                <td className="px-4 py-3">
                  <EstadoGasto codigo={reintegro.estado.codigo} nombre={reintegro.estado.nombre} />
                  {reintegro.fechaReintegro && <p className="mt-1 text-[11px] text-slate-400">{formatoFecha(reintegro.fechaReintegro)}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  {reintegro.estado.codigo === "PENDIENTE" && (
                    <BotonMarcarReintegrado reintegroId={reintegro.id} codigo={reintegro.solicitudGasto.codigo} valor={reintegro.valorReintegro} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {registros.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">
            No hay reintegros {estado === "PENDIENTE" ? "pendientes" : ""}. Se crean solos al registrar la factura real cuando lo pagado supera la factura.
          </p>
        )}
      </div>

      <Paginacion
        pagina={pagina}
        total={total}
        tamano={tamano}
        url={p => `/legalizacion/reintegros?estado=${estado ?? "TODOS"}&pagina=${p}`}
      />
    </div>
  )
}
