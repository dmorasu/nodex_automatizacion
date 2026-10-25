import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

export default async function DireccionPage(props: { searchParams: Promise<FiltrosListadoLotes> }) {
  const searchParams = await props.searchParams
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
