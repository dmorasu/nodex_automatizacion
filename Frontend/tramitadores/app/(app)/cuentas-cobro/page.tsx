import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { z } from "zod"
import { obtenerDatos } from "@/src/lib/api"
import { formatoFechaHora, formatoMoneda } from "@/src/lib/formato"
import { CuentaCobroSchema } from "@/src/schemas"
import Etiqueta from "@/components/ui/Etiqueta"
import { ESTADOS_CUENTA } from "@/components/cuentasCobro/estados"

// Cuentas de cobro que Torre de control le envió: por aprobar, en pago y pagadas
export default async function CuentasCobroPage() {
  const cuentas = (await obtenerDatos("/cuentas-cobro", z.array(CuentaCobroSchema)))!
  const porAprobar = cuentas.filter(c => c.estado === "CON_TRAMITADOR")

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Cuentas de cobro</h1>

      {porAprobar.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-800">Por aprobar</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-900">{formatoMoneda(porAprobar.reduce((s, c) => s + c.total, 0) / 100)}</p>
          <p className="text-xs text-amber-800">{porAprobar.length} cuenta(s)</p>
        </div>
      )}

      <ul className="space-y-3">
        {cuentas.map(c => (
          <li key={c.id}>
            <Link href={`/cuentas-cobro/${c.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{c.numero}</span>
                  <Etiqueta tono={ESTADOS_CUENTA[c.estado].tono}>{ESTADOS_CUENTA[c.estado].nombre}</Etiqueta>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{formatoMoneda(c.total / 100)}</p>
                <p className="text-xs text-slate-500">
                  {c.fechaPago ? `Pagada el ${c.fechaPago.split("-").reverse().join("/")}` : c.enviadaEn ? `Recibida ${formatoFechaHora(c.enviadaEn)}` : ""}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>

      {cuentas.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          Todavía no tiene cuentas de cobro.
        </p>
      )}
    </div>
  )
}
