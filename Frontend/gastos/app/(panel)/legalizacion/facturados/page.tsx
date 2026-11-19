import { fetchApi } from "@/src/lib/api"
import { obtenerCuentas } from "@/src/lib/datosLegalizacion"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaLegalizacion from "@/components/legalizacion/BandejaLegalizacion"
import ExportarExcel from "@/components/gastos/ExportarExcel"
import TablaGastosPorFacturar from "@/components/legalizacion/TablaGastosPorFacturar"
import FiltrosLegalizacion, { filtrosActivos, type FiltrosLegalizacion as Filtros } from "@/components/legalizacion/FiltrosLegalizacion"
import Seccion from "@/components/ui/Seccion"
import Paginacion from "@/components/ui/Paginacion"

const MAXIMO_BANDEJA = 100

// Gastos reembolsables con factura:
//  1. La factura ya está registrada: listos para agregarlos a una cuenta de cobro.
//  2. El tramitador ya subió la factura desde su app: falta registrar sus valores.
export default async function GastosConFacturaPage(props: { searchParams: Promise<Filtros & { pagina?: string }> }) {
  const searchParams = await props.searchParams
  const filtros = filtrosActivos(searchParams)
  const pagina = Math.max(1, Number(searchParams.pagina) || 1)
  // Sin página ni tamaño: es la que usan Exportar y "Seleccionar todos" (todas las páginas)
  const consulta = new URLSearchParams({ alcance: "todos", estado: "FACTURADO", reembolsable: "si", ...filtros })

  const [respuesta, borradores] = await Promise.all([
    fetchApi(`/gastos/solicitudes?${consulta}&pagina=${pagina}&tamano=${MAXIMO_BANDEJA}`),
    obtenerCuentas({ estado: "BORRADOR", tamano: 50 })
  ])

  const { total, registros } = ListadoGastosSchema.parse(await respuesta.json())

  return (
    <div className="space-y-6">
      <FiltrosLegalizacion valores={searchParams} limpiar="/legalizacion/facturados" />

      <Seccion
        titulo="Factura registrada"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{total} gasto(s) facturado(s)</p>
          {total > 0 && <ExportarExcel consulta={consulta} archivo="legalizacion-con-factura" />}
        </div>
        <BandejaLegalizacion gastos={registros} borradores={borradores.registros} todasLasPaginas={{ total, consulta: consulta.toString() }} />
        <div className="mt-3">
          <Paginacion
            pagina={pagina}
            total={total}
            tamano={MAXIMO_BANDEJA}
            url={p => `/legalizacion/facturados?${new URLSearchParams({ ...filtros, pagina: String(p) })}`}
          />
        </div>
      </Seccion>

      <Seccion
        titulo="Factura subida por el tramitador"
      >
        <TablaGastosPorFacturar
          filtros={{ reembolsable: "si", soporteTramitador: "si", ...filtros }}
          vacio="No hay facturas de tramitadores por registrar."
          archivo="legalizacion-facturas-tramitador"
          avisoSoporte
        />
      </Seccion>
    </div>
  )
}
