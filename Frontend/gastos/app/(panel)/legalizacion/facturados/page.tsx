import { fetchApi } from "@/src/lib/api"
import { obtenerCuentas } from "@/src/lib/datosLegalizacion"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaLegalizacion from "@/components/legalizacion/BandejaLegalizacion"
import ExportarCsv from "@/components/legalizacion/ExportarCsv"
import TablaGastosPorFacturar from "@/components/legalizacion/TablaGastosPorFacturar"
import FiltrosLegalizacion, { filtrosActivos, type FiltrosLegalizacion as Filtros } from "@/components/legalizacion/FiltrosLegalizacion"
import Seccion from "@/components/ui/Seccion"

const MAXIMO_BANDEJA = 100

// Gastos reembolsables con factura:
//  1. La factura ya está registrada: listos para agregarlos a una cuenta de cobro.
//  2. El tramitador ya subió la factura desde su app: falta registrar sus valores.
export default async function GastosConFacturaPage({ searchParams }: { searchParams: Filtros }) {
  const filtros = filtrosActivos(searchParams)
  const consulta = new URLSearchParams({ alcance: "todos", estado: "FACTURADO", reembolsable: "si", tamano: String(MAXIMO_BANDEJA), ...filtros })

  const [respuesta, borradores] = await Promise.all([
    fetchApi(`/gastos/solicitudes?${consulta}`),
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
          <p className="text-xs text-amber-700">
            {total > MAXIMO_BANDEJA && `Se muestran ${MAXIMO_BANDEJA} de ${total} gastos facturados. Use los filtros o exporte el listado completo.`}
          </p>
          {total > 0 && <ExportarCsv consulta={consulta} />}
        </div>
        <BandejaLegalizacion gastos={registros} borradores={borradores.registros} />
      </Seccion>

      <Seccion
        titulo="Factura subida por el tramitador"
      >
        <TablaGastosPorFacturar
          filtros={{ reembolsable: "si", soporteTramitador: "si", ...filtros }}
          vacio="No hay facturas de tramitadores por registrar."
          avisoSoporte
        />
      </Seccion>
    </div>
  )
}
