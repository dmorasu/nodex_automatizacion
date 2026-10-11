import Link from "next/link"
import { fetchApi } from "@/src/lib/api"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaContabilizarGastos from "@/components/contabilidad/BandejaContabilizarGastos"
import BandejaSoportes from "@/components/legalizacion/BandejaSoportes"
import TablaGastosPorFacturar from "@/components/legalizacion/TablaGastosPorFacturar"
import Buscador from "@/components/ui/Buscador"

const MAXIMO_BANDEJA = 100

const VISTAS = [
  { codigo: "sin-factura", nombre: "Sin factura" },
  { codigo: "soportes", nombre: "Soportes del tramitador" },
  { codigo: "por-contabilizar", nombre: "Por contabilizar" }
] as const

type Parametros = { vista?: string, busqueda?: string, estado?: string }

// Gastos NO reembolsables: los asume la bolsa y no pasan por Legalización.
// Contabilidad registra su factura (o aprueba la que sube el tramitador) y los contabiliza.
export default async function NoReembolsablesPage({ searchParams }: { searchParams: Parametros }) {
  const vista = VISTAS.some(v => v.codigo === searchParams.vista) ? searchParams.vista! : "sin-factura"

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap gap-2 text-xs">
        {VISTAS.map(v => (
          <Link
            key={v.codigo}
            href={`/contabilidad/no-reembolsables?vista=${v.codigo}`}
            className={`rounded-full border px-3 py-1 font-semibold ${vista === v.codigo ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {v.nombre}
          </Link>
        ))}
      </div>

      {vista === "sin-factura" && (
        <>
          <Buscador valor={searchParams.busqueda} ocultos={{ vista }} />
          <TablaGastosPorFacturar
            filtros={{ reembolsable: "no" }}
            busqueda={searchParams.busqueda}
            vacio="No hay gastos no reembolsables pagados sin factura."
            avisoSoporte
          />
        </>
      )}

      {vista === "soportes" && (
        <BandejaSoportes
          estado={searchParams.estado}
          reembolsable="no"
          urlEstado={estado => `/contabilidad/no-reembolsables?vista=soportes&estado=${estado}`}
        />
      )}

      {vista === "por-contabilizar" && <PorContabilizar />}
    </div>
  )
}

// Legalizados con su factura, pendientes de contabilizar
// (los que quedaron en una cuenta de cobro se contabilizan con su cuenta)
async function PorContabilizar() {
  const consulta = new URLSearchParams({
    alcance: "todos",
    estado: "LEGALIZADO",
    reembolsable: "no",
    sinCuentaCobro: "si",
    tamano: String(MAXIMO_BANDEJA)
  })
  const { total, registros } = ListadoGastosSchema.parse(await (await fetchApi(`/gastos/solicitudes?${consulta}`)).json())

  return (
    <div className="space-y-3">
      {total > MAXIMO_BANDEJA && (
        <p className="text-xs text-amber-700">Se muestran {MAXIMO_BANDEJA} de {total} gastos pendientes.</p>
      )}
      <BandejaContabilizarGastos gastos={registros} />
    </div>
  )
}
