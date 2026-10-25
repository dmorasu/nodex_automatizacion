import Link from "next/link"
import { fetchApi } from "@/src/lib/api"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaDescargaDocumentos from "@/components/legalizacion/BandejaDescargaDocumentos"
import ExportarCsv from "@/components/legalizacion/ExportarCsv"
import FiltrosLegalizacion, { filtrosActivos, type FiltrosLegalizacion as Filtros } from "@/components/legalizacion/FiltrosLegalizacion"

const MAXIMO_BANDEJA = 100

// Grupos de gastos reembolsables (ya pagados) para descargar sus documentos
const GRUPOS = [
  { codigo: "", nombre: "Todos los pagados", filtros: { pagados: "si" } },
  { codigo: "sin-factura", nombre: "Sin factura", filtros: { estado: "PAGADO" } },
  { codigo: "facturados", nombre: "Con factura", filtros: { estado: "FACTURADO" } },
  { codigo: "en-cuenta", nombre: "En cuenta de cobro", filtros: { estado: "EN_CUENTA_COBRO" } },
  { codigo: "legalizados", nombre: "Legalizados", filtros: { estado: "LEGALIZADO" } }
] as const

// Seleccione los gastos y descargue todos sus documentos en un ZIP, sin carpetas (las operaciones
// con descarga de pago unificada bajan un solo PDF de pago por gasto)
export default async function DescargasPage(props: { searchParams: Promise<Filtros & { grupo?: string }> }) {
  const searchParams = await props.searchParams
  const grupo = GRUPOS.find(g => g.codigo === (searchParams.grupo ?? "")) ?? GRUPOS[0]
  const filtros = filtrosActivos(searchParams)

  const consulta = new URLSearchParams({ alcance: "todos", reembolsable: "si", tamano: String(MAXIMO_BANDEJA), ...grupo.filtros, ...filtros })
  const { total, registros } = ListadoGastosSchema.parse(await (await fetchApi(`/gastos/solicitudes?${consulta}`)).json())

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap gap-2 text-xs">
        {GRUPOS.map(g => {
          // Al cambiar de grupo se conservan los filtros
          const parametros = new URLSearchParams(Object.entries({ grupo: g.codigo, ...filtros }).filter(([, v]) => v) as [string, string][])
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

      <FiltrosLegalizacion valores={searchParams} ocultos={{ grupo: grupo.codigo }} limpiar={grupo.codigo ? `/legalizacion/descargas?grupo=${grupo.codigo}` : "/legalizacion/descargas"} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-amber-700">
          {total > MAXIMO_BANDEJA && `Se muestran ${MAXIMO_BANDEJA} de ${total} gastos. Use los filtros o exporte el listado completo.`}
        </p>
        {total > 0 && <ExportarCsv consulta={consulta} />}
      </div>

      <BandejaDescargaDocumentos gastos={registros} />
    </div>
  )
}
