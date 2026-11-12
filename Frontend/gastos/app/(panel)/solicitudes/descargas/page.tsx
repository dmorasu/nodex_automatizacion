import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requiereAcceso } from "@/src/auth/dal"
import { fetchApi } from "@/src/lib/api"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaDescargaDocumentos from "@/components/legalizacion/BandejaDescargaDocumentos"
import FiltrosLegalizacion, { filtrosActivos, type FiltrosLegalizacion as Filtros } from "@/components/legalizacion/FiltrosLegalizacion"

const MAXIMO_BANDEJA = 100

// Grupos como en Legalización → Descargar documentos, más "Todos" (los gastos aún sin pagar
// también tienen documentos: los que se subieron al crearlos)
const GRUPOS = [
  { codigo: "", nombre: "Todos", filtros: {} },
  { codigo: "pagados", nombre: "Pagados", filtros: { pagados: "si" } },
  { codigo: "sin-factura", nombre: "Sin factura", filtros: { estado: "PAGADO" } },
  { codigo: "facturados", nombre: "Con factura", filtros: { estado: "FACTURADO" } },
  { codigo: "en-cuenta", nombre: "En cuenta de cobro", filtros: { estado: "EN_CUENTA_COBRO" } },
  { codigo: "legalizados", nombre: "Legalizados", filtros: { estado: "LEGALIZADO" } }
] as const

// Mis gastos → Descargar documentos (pedido del usuario, 2026-11-12): la misma bandeja de
// Legalización con los gastos propios (al buscar, también los de su área, como en Mis gastos).
// El backend solo deja descargar los gastos que la persona puede ver.
export default async function DescargasMisGastosPage(props: { searchParams: Promise<Filtros & { grupo?: string }> }) {
  const searchParams = await props.searchParams
  await requiereAcceso([])
  const grupo = GRUPOS.find(g => g.codigo === (searchParams.grupo ?? "")) ?? GRUPOS[0]
  const filtros = filtrosActivos(searchParams)

  const consulta = new URLSearchParams({ alcance: "mios", tamano: String(MAXIMO_BANDEJA), ...grupo.filtros, ...filtros })
  const { total, registros } = ListadoGastosSchema.parse(await (await fetchApi(`/gastos/solicitudes?${consulta}`)).json())

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/solicitudes" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <ArrowLeft size={13} /> Mis gastos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">Descargar documentos</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {GRUPOS.map(g => {
          // Al cambiar de grupo se conservan los filtros
          const parametros = new URLSearchParams(Object.entries({ grupo: g.codigo, ...filtros }).filter(([, v]) => v) as [string, string][])
          return (
            <Link
              key={g.codigo}
              href={`/solicitudes/descargas?${parametros}`}
              className={`rounded-full border px-3 py-1 font-semibold ${grupo.codigo === g.codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              {g.nombre}
            </Link>
          )
        })}
      </div>

      <FiltrosLegalizacion valores={searchParams} ocultos={{ grupo: grupo.codigo }} limpiar={grupo.codigo ? `/solicitudes/descargas?grupo=${grupo.codigo}` : "/solicitudes/descargas"} />

      {total > MAXIMO_BANDEJA && (
        <p className="text-xs text-amber-700">Se muestran {MAXIMO_BANDEJA} de {total} gastos. Use los filtros para encontrar los que necesita.</p>
      )}

      <BandejaDescargaDocumentos gastos={registros} />
    </div>
  )
}
