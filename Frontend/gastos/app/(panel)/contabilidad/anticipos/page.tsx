import Link from "next/link"
import { obtenerAnticipos } from "@/src/lib/datosAnticipos"
import TablaAnticipos from "@/components/anticipos/TablaAnticipos"
import Buscador from "@/components/ui/Buscador"
import Paginacion from "@/components/ui/Paginacion"

const FILTROS = [
  ["POR_CONFIRMAR", "Por confirmar"],
  ["NOVEDAD", "Devueltos con novedad"],
  ["CONFIRMADO", "Confirmados"]
] as const

// Contabilidad verifica en el banco que entró el dinero de cada anticipo y lo confirma con el
// recibo de caja (uno o varios a la vez) o lo devuelve con novedad desde su detalle
export default async function AnticiposContabilidadPage({ searchParams }: { searchParams: { estado?: string, busqueda?: string, pagina?: string } }) {
  const estado = FILTROS.some(([codigo]) => codigo === searchParams.estado) ? searchParams.estado! : "POR_CONFIRMAR"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const porConfirmar = estado === "POR_CONFIRMAR"
  const { total, tamano, registros } = await obtenerAnticipos({
    alcance: "todos",
    // Las solicitudes de factura tienen su propia pestaña
    clase: "ANTICIPO",
    estado,
    busqueda: searchParams.busqueda,
    pagina,
    // Por confirmar se trabaja en bloque (confirmación masiva)
    tamano: porConfirmar ? 100 : 20
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {FILTROS.map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={`/contabilidad/anticipos?estado=${codigo}`}
            className={`rounded-full border px-3 py-1 font-semibold ${estado === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
      </div>

      <Buscador
        valor={searchParams.busqueda}
        ocultos={{ estado }}
        placeholder="N.º de solicitud (ANT-…), placa, matrícula, recibo de caja o cliente"
      />

      <TablaAnticipos
        anticipos={registros}
        seleccionable={porConfirmar}
        vacio={porConfirmar ? "No hay anticipos por confirmar." : "No hay anticipos en este estado."}
      />

      <Paginacion
        pagina={pagina}
        total={total}
        tamano={tamano}
        url={p => `/contabilidad/anticipos?estado=${estado}${searchParams.busqueda ? `&busqueda=${encodeURIComponent(searchParams.busqueda)}` : ""}&pagina=${p}`}
      />
    </div>
  )
}
