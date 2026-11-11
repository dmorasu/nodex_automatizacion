import Link from "next/link"
import clsx from "clsx"
import { obtenerReembolsos } from "@/src/lib/datosCajaMenor"
import TablaReembolsos from "@/components/cajaMenor/TablaReembolsos"
import Paginacion from "@/components/ui/Paginacion"

// Reembolsos de caja menor aprobados por Dirección: Contabilidad los registra en SIESA y los marca
// contabilizados; Tesorería lo ve en Caja menor para retirar el dinero y reponer la caja
const FILTROS = [
  ["no", "Por contabilizar"],
  ["si", "Contabilizados"]
] as const

export default async function CajasMenoresContabilidadPage(props: { searchParams: Promise<{ contabilizado?: string, pagina?: string }> }) {
  const searchParams = await props.searchParams
  const contabilizado = searchParams.contabilizado === "si" ? "si" : "no"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const { total, tamano, registros } = await obtenerReembolsos({ estado: "APROBADO,LEGALIZADO", contabilizado, pagina })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/contabilidad/caja-menor?contabilizado=${codigo}`}
            className={clsx("rounded-full border px-3 py-1 text-xs font-semibold", contabilizado === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
          >
            {nombre}
          </Link>
        ))}
      </div>
      <TablaReembolsos reembolsos={registros} base="/contabilidad/caja-menor" vacio={contabilizado === "no" ? "No hay reembolsos de caja menor por contabilizar." : "No hay reembolsos contabilizados."} />
      <Paginacion pagina={pagina} total={total} tamano={tamano} url={p => `/contabilidad/caja-menor?contabilizado=${contabilizado}&pagina=${p}`} />
    </div>
  )
}
