import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

// Pagos confirmados (con soporte del banco y bolsa descontada)
export default function LotesPage({ searchParams }: { searchParams: FiltrosListadoLotes }) {
  return (
    <ListadoLotes
      searchParams={searchParams}
      estado="PAGADO"
      rutaBase="/tesoreria/lotes"
      rutaDetalle="/tesoreria/lotes"
      vacio="Aún no se han registrado pagos."
    />
  )
}
