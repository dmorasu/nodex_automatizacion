import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

// Lotes ya revisados: aprobados (falta que Tesorería confirme), pagados y rechazados
export default async function HistorialDireccionPage(props: { searchParams: Promise<FiltrosListadoLotes> }) {
  const searchParams = await props.searchParams
  return (
    <ListadoLotes
      searchParams={searchParams}
      estado="APROBADO,PAGADO,RECHAZADO"
      rutaBase="/direccion/historial"
      rutaDetalle="/direccion/lotes"
      vacio="Aún no hay pagos revisados."
    />
  )
}
