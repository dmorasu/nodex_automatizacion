import Link from "next/link"
import { obtenerAnticipos } from "@/src/lib/datosAnticipos"
import TablaAnticipos from "@/components/anticipos/TablaAnticipos"
import Buscador from "@/components/ui/Buscador"
import Paginacion from "@/components/ui/Paginacion"

const FILTROS = [
  ["POR_CONFIRMAR", "Por facturar"],
  ["NOVEDAD", "Devueltas con novedad"],
  ["FACTURADO", "Facturadas"]
] as const

// Solicitudes de factura: Contabilidad confirma que el dinero entró y adjunta la factura (PDF y XML)
// en un solo paso, una o varias a la vez; o la devuelve con novedad desde su detalle
export default async function FacturasContabilidadPage({ searchParams }: { searchParams: { estado?: string, busqueda?: string, pagina?: string } }) {
  const estado = FILTROS.some(([codigo]) => codigo === searchParams.estado) ? searchParams.estado! : "POR_CONFIRMAR"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const porFacturar = estado === "POR_CONFIRMAR"
  const { total, tamano, registros } = await obtenerAnticipos({
    alcance: "todos",
    clase: "FACTURA",
    estado,
    busqueda: searchParams.busqueda,
    pagina,
    // Por facturar se trabaja en bloque (facturación masiva)
    tamano: porFacturar ? 50 : 20
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/contabilidad/facturas?estado=${codigo}`}
            className={`rounded-full border px-3 py-1 font-semibold ${estado === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      <Buscador
        valor={searchParams.busqueda}
        ocultos={{ estado }}
        placeholder="N.º de solicitud (FAC-…), placa, matrícula, factura o cliente"
      />

      <TablaAnticipos
        anticipos={registros}
        seleccionable={porFacturar}
        modo="facturar"
        vacio={porFacturar ? "No hay solicitudes por facturar." : "No hay solicitudes en este estado."}
      />

      <Paginacion
        pagina={pagina}
        total={total}
        tamano={tamano}
        url={p => `/contabilidad/facturas?estado=${estado}${searchParams.busqueda ? `&busqueda=${encodeURIComponent(searchParams.busqueda)}` : ""}&pagina=${p}`}
      />
    </div>
  )
}
