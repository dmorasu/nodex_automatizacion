import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

// Lotes programados: esperando la aprobación de Dirección de Negocio, o aprobados y
// pendientes de adjuntar el soporte del banco y confirmar el pago (uno o varios a la vez)
export default async function ProgramadosPage(props: { searchParams: Promise<FiltrosListadoLotes> }) {
  const searchParams = await props.searchParams
  return (
    <ListadoLotes
      searchParams={searchParams}
      estado="PROGRAMADO,APROBADO"
      rutaBase="/tesoreria/programados"
      rutaDetalle="/tesoreria/lotes"
      vacio="No hay pagos programados."
      confirmables
    />
  )
}
