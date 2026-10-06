import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

export default function DireccionPage({ searchParams }: { searchParams: FiltrosListadoLotes }) {
  return (
    <ListadoLotes
      searchParams={searchParams}
      estado="PROGRAMADO"
      rutaBase="/direccion"
      rutaDetalle="/direccion/lotes"
      vacio="No hay pagos pendientes de aprobación."
    />
  )
}
