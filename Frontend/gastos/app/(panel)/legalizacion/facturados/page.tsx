import { fetchApi } from "@/src/lib/api"
import { obtenerCuentas } from "@/src/lib/datosLegalizacion"
import { ListadoGastosSchema } from "@/src/schemas/gastos"
import BandejaLegalizacion from "@/components/legalizacion/BandejaLegalizacion"
import TablaGastosPorFacturar from "@/components/legalizacion/TablaGastosPorFacturar"
import Buscador from "@/components/ui/Buscador"
import Seccion from "@/components/ui/Seccion"

const MAXIMO_BANDEJA = 100

// Gastos reembolsables con factura:
//  1. El tramitador ya subió la factura desde su app: falta registrar sus valores.
//  2. La factura ya está registrada: listos para agregarlos a una cuenta de cobro.
export default async function GastosConFacturaPage({ searchParams }: { searchParams: { busqueda?: string } }) {
  const consulta = new URLSearchParams({ alcance: "todos", estado: "FACTURADO", reembolsable: "si", tamano: String(MAXIMO_BANDEJA) })
  if (searchParams.busqueda) consulta.set("busqueda", searchParams.busqueda)

  const [respuesta, borradores] = await Promise.all([
    fetchApi(`/gastos/solicitudes?${consulta}`),
    obtenerCuentas({ estado: "BORRADOR", tamano: 50 })
  ])

  const { total, registros } = ListadoGastosSchema.parse(await respuesta.json())

  return (
    <div className="space-y-6">
      <Buscador valor={searchParams.busqueda} />

      <Seccion
        titulo="Factura subida por el tramitador"
      >
        <TablaGastosPorFacturar
          filtros={{ reembolsable: "si", soporteTramitador: "si" }}
          busqueda={searchParams.busqueda}
          vacio="No hay facturas de tramitadores por registrar."
          avisoSoporte
        />
      </Seccion>

      <Seccion
        titulo="Factura registrada"
      >
        {total > MAXIMO_BANDEJA && (
          <p className="mb-3 text-xs text-amber-700">
            Se muestran {MAXIMO_BANDEJA} de {total} gastos facturados. Use la búsqueda para encontrar los demás.
          </p>
        )}
        <BandejaLegalizacion gastos={registros} borradores={borradores.registros} />
      </Seccion>
    </div>
  )
}
