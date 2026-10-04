import TablaGastosPorFacturar from "@/components/legalizacion/TablaGastosPorFacturar"
import Buscador from "@/components/ui/Buscador"

// Gastos reembolsables ya pagados que aún no tienen factura: el trámite no ha terminado.
// Se muestra cómo va el trámite en Nodex Trámites. Cuando el tramitador sube la factura
// desde su app, el gasto pasa a "Gastos con factura".
export default function GastosSinFacturaPage({ searchParams }: { searchParams: { busqueda?: string } }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Pagados, sin factura todavía: el trámite sigue en curso. Revise su estado en Nodex Trámites.
      </p>
      <Buscador valor={searchParams.busqueda} />
      <TablaGastosPorFacturar
        filtros={{ reembolsable: "si", soporteTramitador: "no" }}
        busqueda={searchParams.busqueda}
        vacio="No hay gastos pagados sin factura."
      />
    </div>
  )
}
