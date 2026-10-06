import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

// Lotes programados: esperando la aprobación de Dirección de Negocio, o aprobados y
// pendientes de adjuntar el soporte del banco y confirmar el pago
export default function ProgramadosPage({ searchParams }: { searchParams: FiltrosListadoLotes }) {
  return (
    <ListadoLotes
      searchParams={searchParams}
      estado="PROGRAMADO,APROBADO"
      rutaBase="/tesoreria/programados"
      rutaDetalle="/tesoreria/lotes"
      vacio="No hay pagos programados."
    />
  )
}
