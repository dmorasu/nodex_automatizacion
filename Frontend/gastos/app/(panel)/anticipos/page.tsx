import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { tieneRolDeGastos } from "@/src/auth/permisos"
import { obtenerAnticipos } from "@/src/lib/datosAnticipos"
import { CLASES_ANTICIPO, ESTADOS_ANTICIPO } from "@/src/schemas/gastos"
import TablaAnticipos from "@/components/anticipos/TablaAnticipos"
import Buscador from "@/components/ui/Buscador"
import Paginacion from "@/components/ui/Paginacion"
import { claseBotonPrimario, claseBotonSecundario } from "@/components/ui/estilos"

type Filtros = { alcance?: string, clase?: string, estado?: string, busqueda?: string, pagina?: string }

const claseChip = (activo: boolean) =>
  `rounded-full border px-3 py-1 font-semibold ${activo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`

const urlCon = (filtros: Filtros, cambios: Filtros) =>
  `/anticipos?${new URLSearchParams(Object.entries({ ...filtros, ...cambios, pagina: cambios.pagina ?? "" }).filter(([, v]) => v) as [string, string][])}`

// Anticipos (ingresos) de clientes del banco y solicitudes de factura: los registra la operación
// y los confirma (o factura) Contabilidad. Es también el inventario de quién ha pagado
export default async function AnticiposPage(props: { searchParams: Promise<Filtros> }) {
  const searchParams = await props.searchParams
  const sesion = await requiereAcceso([])
  const puedeVerTodos = tieneRolDeGastos(sesion.roles)
  const alcance = puedeVerTodos && searchParams.alcance === "todos" ? "todos" : "mios"
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  const clase = searchParams.clase && CLASES_ANTICIPO[searchParams.clase] ? searchParams.clase : ""
  // "Confirmado" es de los anticipos y "Facturado" de las solicitudes de factura
  const estados = Object.entries(ESTADOS_ANTICIPO)
    .filter(([codigo]) => !(clase === "FACTURA" && codigo === "CONFIRMADO") && !(clase === "ANTICIPO" && codigo === "FACTURADO"))

  const { total, tamano, registros } = await obtenerAnticipos({
    alcance,
    clase: clase || undefined,
    estado: searchParams.estado,
    busqueda: searchParams.busqueda,
    pagina
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{alcance === "todos" ? "Todos los anticipos" : "Mis anticipos"}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/anticipos/nuevo?clase=FACTURA" className={claseBotonSecundario}>
            <FileText size={15} />
            Solicitud de factura
          </Link>
          <Link href="/anticipos/nuevo" className={claseBotonPrimario}>
            <Plus size={15} />
            Nuevo anticipo
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[["", "Anticipos y facturas"], ...Object.entries(CLASES_ANTICIPO).map(([codigo, nombre]) => [codigo, codigo === "FACTURA" ? "Solicitudes de factura" : "Anticipos"])].map(([codigo, nombre]) => (
          <Link key={codigo} href={urlCon(searchParams, { clase: codigo, estado: "" })} className={claseChip(clase === codigo)}>
            {nombre}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[["", "Todos"], ...estados.map(([codigo, e]) => [codigo, e.nombre])].map(([codigo, nombre]) => (
          <Link key={codigo} href={urlCon(searchParams, { estado: codigo })} className={claseChip((searchParams.estado ?? "") === codigo)}>
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
        ocultos={{ alcance: searchParams.alcance, clase: searchParams.clase, estado: searchParams.estado }}
        placeholder="N.º de solicitud (ANT-… o FAC-…), placa, matrícula, recibo de caja, factura o cliente"
      />

      <TablaAnticipos anticipos={registros} vacio="No hay anticipos con estos filtros." />

      <Paginacion pagina={pagina} total={total} tamano={tamano} url={p => urlCon(searchParams, { pagina: String(p) })} />
    </div>
  )
}
