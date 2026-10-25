import Link from "next/link"
import clsx from "clsx"
import { obtenerReembolsos } from "@/src/lib/datosCajaMenor"
import TablaReembolsos from "@/components/cajaMenor/TablaReembolsos"
import Paginacion from "@/components/ui/Paginacion"

const FILTROS = [
  ["POR_APROBAR", "Por aprobar"],
  ["APROBADO,LEGALIZADO", "Aprobados"],
  ["BORRADOR", "Devueltos o en borrador"]
] as const

// Reembolsos de caja menor que envía Tesorería para aprobación de Dirección de Negocio
export default async function ReembolsosDireccionPage(props: { searchParams: Promise<{ estado?: string, pagina?: string }> }) {
  const searchParams = await props.searchParams
  const estado = FILTROS.some(([codigo]) => codigo === searchParams.estado) ? searchParams.estado! : "POR_APROBAR"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const { total, tamano, registros } = await obtenerReembolsos({ estado, pagina })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/direccion/caja-menor?estado=${codigo}`}
            className={clsx("rounded-full border px-3 py-1 text-xs font-semibold", estado === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
          >
            {nombre}
          </Link>
        ))}
      </div>
      <TablaReembolsos reembolsos={registros} base="/direccion/caja-menor" vacio={estado === "POR_APROBAR" ? "No hay reembolsos por aprobar." : "No hay reembolsos en este estado."} />
      <Paginacion pagina={pagina} total={total} tamano={tamano} url={p => `/direccion/caja-menor?estado=${estado}&pagina=${p}`} />
    </div>
  )
}
