import ListadoLotes, { type FiltrosListadoLotes } from "@/components/tesoreria/ListadoLotes"

// Pagos confirmados (con soporte del banco y bolsa descontada)
export default async function LotesPage(props: { searchParams: Promise<FiltrosListadoLotes> }) {
  const searchParams = await props.searchParams
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
