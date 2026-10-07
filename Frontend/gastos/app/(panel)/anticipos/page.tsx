import Link from "next/link"
import { Plus } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { tieneRolDeGastos } from "@/src/auth/permisos"
import { obtenerAnticipos } from "@/src/lib/datosAnticipos"
import { ESTADOS_ANTICIPO } from "@/src/schemas/gastos"
import TablaAnticipos from "@/components/anticipos/TablaAnticipos"
import Buscador from "@/components/ui/Buscador"
import Paginacion from "@/components/ui/Paginacion"
import { claseBotonPrimario } from "@/components/ui/estilos"

type Filtros = { alcance?: string, estado?: string, busqueda?: string, pagina?: string }

const urlCon = (filtros: Filtros, cambios: Filtros) =>
  `/anticipos?${new URLSearchParams(Object.entries({ ...filtros, ...cambios, pagina: cambios.pagina ?? "" }).filter(([, v]) => v) as [string, string][])}`

// Anticipos (ingresos) de clientes del banco: los registra la operación y los confirma Contabilidad
export default async function AnticiposPage({ searchParams }: { searchParams: Filtros }) {
  const sesion = await requiereAcceso([])
  const puedeVerTodos = tieneRolDeGastos(sesion.roles)
  const alcance = puedeVerTodos && searchParams.alcance === "todos" ? "todos" : "mios"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)

  const { total, tamano, registros } = await obtenerAnticipos({
    alcance,
    estado: searchParams.estado,
    busqueda: searchParams.busqueda,
    pagina
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{alcance === "todos" ? "Todos los anticipos" : "Mis anticipos"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Pagos de clientes del banco. Contabilidad confirma que el dinero entró; después se convierten en gastos.
          </p>
        </div>
        <Link href="/anticipos/nuevo" className={claseBotonPrimario}>
          <Plus size={15} />
          Nuevo anticipo
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[["", "Todos"], ...Object.entries(ESTADOS_ANTICIPO).map(([codigo, e]) => [codigo, e.nombre])].map(([codigo, nombre]) => (
          <Link
            key={codigo}
            href={urlCon(searchParams, { estado: codigo })}
            className={`rounded-full border px-3 py-1 font-semibold ${(searchParams.estado ?? "") === codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {nombre}
          </Link>
        ))}
        {puedeVerTodos && (
          <Link href={urlCon(searchParams, { alcance: alcance === "todos" ? "mios" : "todos" })} className="ml-auto font-medium text-emerald-700 hover:underline">
            {alcance === "todos" ? "Ver solo los míos" : "Ver todos"}
          </Link>
        )}
      </div>

      <Buscador
        valor={searchParams.busqueda}
        ocultos={{ alcance: searchParams.alcance, estado: searchParams.estado }}
        placeholder="N.º de solicitud (ANT-…), placa, matrícula, recibo de caja o cliente"
      />

      <TablaAnticipos anticipos={registros} vacio="No hay anticipos con estos filtros." />

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={p => urlCon(searchParams, { pagina: String(p) })} />
    </div>
  )
}
