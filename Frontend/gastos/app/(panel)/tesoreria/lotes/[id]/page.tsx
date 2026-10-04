import DetalleLote from "@/components/tesoreria/DetalleLote"

export default function LotePage({ params }: { params: { id: string } }) {
  return <DetalleLote id={Number(params.id)} rutaVolver="/tesoreria/lotes" etiquetaVolver="Volver a pagos realizados" modo="tesoreria" />
}
