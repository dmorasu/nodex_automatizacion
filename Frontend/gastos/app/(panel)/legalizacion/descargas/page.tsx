import Link from "next/link"
import { fetchApi } from "@/src/lib/api"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaDescargaDocumentos from "@/components/legalizacion/BandejaDescargaDocumentos"
import Buscador from "@/components/ui/Buscador"

const MAXIMO_BANDEJA = 100

// Grupos de gastos reembolsables (ya pagados) para descargar sus documentos
const GRUPOS = [
  { codigo: "", nombre: "Todos los pagados", filtros: { pagados: "si" } },
  { codigo: "sin-factura", nombre: "Sin factura", filtros: { estado: "PAGADO" } },
  { codigo: "facturados", nombre: "Con factura", filtros: { estado: "FACTURADO" } },
  { codigo: "en-cuenta", nombre: "En cuenta de cobro", filtros: { estado: "EN_CUENTA_COBRO" } },
  { codigo: "legalizados", nombre: "Legalizados", filtros: { estado: "LEGALIZADO" } }
] as const

// Seleccione los gastos y descargue todos sus documentos en un ZIP (una carpeta por gasto)
export default async function DescargasPage({ searchParams }: { searchParams: { grupo?: string, busqueda?: string } }) {
  const grupo = GRUPOS.find(g => g.codigo === (searchParams.grupo ?? "")) ?? GRUPOS[0]

  const consulta = new URLSearchParams({ alcance: "todos", reembolsable: "si", tamano: String(MAXIMO_BANDEJA), ...grupo.filtros })
  if (searchParams.busqueda) consulta.set("busqueda", searchParams.busqueda)
  const { total, registros } = ListadoGastosSchema.parse(await (await fetchApi(`/gastos/solicitudes?${consulta}`)).json())

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap gap-2 text-xs">
        {GRUPOS.map(g => {
          const parametros = new URLSearchParams(Object.entries({ grupo: g.codigo, busqueda: searchParams.busqueda }).filter(([, v]) => v) as [string, string][])
          return (
            <Link
              key={g.codigo}
              href={`/legalizacion/descargas?${parametros}`}
              className={`rounded-full border px-3 py-1 font-semibold ${grupo.codigo === g.codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              {g.nombre}
            </Link>
          )
        })}
      </div>

      <Buscador valor={searchParams.busqueda} ocultos={{ grupo: grupo.codigo }} />

      {total > MAXIMO_BANDEJA && (
        <p className="text-xs text-amber-700">Se muestran {MAXIMO_BANDEJA} de {total} gastos. Use la búsqueda para encontrar los demás.</p>
      )}

      <BandejaDescargaDocumentos gastos={registros} />
    </div>
  )
}
