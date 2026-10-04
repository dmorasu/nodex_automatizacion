import { ROLES } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import Link from "next/link"
import clsx from "clsx"
import { ArrowLeft } from "lucide-react"
import { obtenerMovimientos } from "@/src/lib/datosTesoreria"
import { formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import Paginacion from "@/components/ui/Paginacion"

const NOMBRES_TIPO: Record<string, string> = {
  RECARGA: "Recarga",
  PAGO: "Pago",
  REINTEGRO: "Reintegro",
  LEGALIZACION: "Legalización",
  REVERSO: "Reverso",
  AJUSTE: "Ajuste"
}

export default async function MovimientosBolsaPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams: { pagina?: string }
}) {
  // Solo Tesorería general (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso([ROLES.TESORERIA])

  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const { bolsa, total, tamano, registros } = await obtenerMovimientos(Number(params.id), pagina)

  return (
    <div className="space-y-4">
      <Link href="/tesoreria/bolsas" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={14} />
        Volver a bolsas
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{bolsa.nombre}</h2>
          <p className="text-xs text-slate-400">{bolsa.lineaNegocio ?? "Sin línea de negocio"} · {total} movimiento(s)</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Saldo actual</p>
          <p className="text-lg font-semibold text-slate-800">{formatoMoneda(bolsa.saldoActual)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold text-right">Valor</th>
              <th className="px-4 py-3 font-semibold text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map(movimiento => {
              const valor = Number(movimiento.valor)

              return (
                <tr key={movimiento.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatoFechaHora(movimiento.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{NOMBRES_TIPO[movimiento.tipo] ?? movimiento.tipo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {movimiento.solicitudGasto && (
                      <Link href={`/solicitudes/${movimiento.solicitudGasto.id}`} className="font-semibold text-emerald-700 hover:underline">
                        {movimiento.solicitudGasto.codigo}
                      </Link>
                    )}
                    {movimiento.lotePagoId && (
                      <Link href={`/tesoreria/lotes/${movimiento.lotePagoId}`} className="ml-2 text-slate-400 hover:underline">
                        lote #{movimiento.lotePagoId}
                      </Link>
                    )}
                    {movimiento.observacion && !movimiento.solicitudGasto && <span>{movimiento.observacion}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{movimiento.usuario?.nombreUsuario}</td>
                  <td className={clsx("px-4 py-3 text-right font-semibold whitespace-nowrap", valor < 0 ? "text-red-600" : "text-emerald-700")}>
                    {valor > 0 && "+"}{formatoMoneda(valor)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{formatoMoneda(movimiento.saldoResultante)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {registros.length === 0 && (
          <p className="py-14 text-center text-sm text-slate-400">Esta bolsa no tiene movimientos. Empiece con una recarga.</p>
        )}
      </div>

      <Paginacion
        pagina={pagina}
        total={total}
        tamano={tamano}
        url={p => `/tesoreria/bolsas/${bolsa.id}?pagina=${p}`}
      />
    </div>
  )
}
