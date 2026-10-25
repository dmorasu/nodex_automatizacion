import BandejaSoportes from "@/components/legalizacion/BandejaSoportes"

// Soportes de los tramitadores para gastos reembolsables (los no reembolsables los revisa Contabilidad)
export default async function SoportesTramitadorPage(props: { searchParams: Promise<{ estado?: string }> }) {
  const searchParams = await props.searchParams
  return (
    <BandejaSoportes
      estado={searchParams.estado}
      reembolsable="si"
      urlEstado={estado => `/legalizacion/soportes?estado=${estado}`}
    />
  )
}
