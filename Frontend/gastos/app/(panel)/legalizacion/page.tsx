import TablaGastosPorFacturar from "@/components/legalizacion/TablaGastosPorFacturar"
import FiltrosLegalizacion, { filtrosActivos, type FiltrosLegalizacion as Filtros } from "@/components/legalizacion/FiltrosLegalizacion"

// Gastos reembolsables ya pagados que aún no tienen factura: el trámite no ha terminado.
// Se muestra cómo va el trámite en Nodex Trámites. Cuando el tramitador sube la factura
// desde su app, el gasto pasa a "Gastos con factura".
export default function GastosSinFacturaPage({ searchParams }: { searchParams: Filtros }) {
  return (
    <div className="space-y-4">
      <FiltrosLegalizacion valores={searchParams} limpiar="/legalizacion" />
      <TablaGastosPorFacturar
        filtros={{ reembolsable: "si", soporteTramitador: "no", ...filtrosActivos(searchParams) }}
        vacio="No hay gastos pagados sin factura."
      />
    </div>
  )
}
