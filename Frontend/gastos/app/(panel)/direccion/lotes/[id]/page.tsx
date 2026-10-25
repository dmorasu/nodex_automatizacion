import DetalleLote from "@/components/tesoreria/DetalleLote"

export default async function LoteDireccionPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <DetalleLote id={Number(params.id)} rutaVolver="/direccion" etiquetaVolver="Volver a Aprobación de pagos" modo="direccion" />
}
