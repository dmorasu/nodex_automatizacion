import DetalleLote from "@/components/tesoreria/DetalleLote"

export default function LoteDireccionPage({ params }: { params: { id: string } }) {
  return <DetalleLote id={Number(params.id)} rutaVolver="/direccion" etiquetaVolver="Volver a Aprobación de pagos" modo="direccion" />
}
