import BandejaSoportes from "@/components/legalizacion/BandejaSoportes"

// Soportes de los tramitadores para gastos reembolsables (los no reembolsables los revisa Contabilidad)
export default function SoportesTramitadorPage({ searchParams }: { searchParams: { estado?: string } }) {
  return (
    <BandejaSoportes
      estado={searchParams.estado}
      reembolsable="si"
      urlEstado={estado => `/legalizacion/soportes?estado=${estado}`}
    />
  )
}
