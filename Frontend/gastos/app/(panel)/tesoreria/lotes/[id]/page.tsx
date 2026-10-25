import DetalleLote from "@/components/tesoreria/DetalleLote"

export default async function LotePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <DetalleLote id={Number(params.id)} rutaVolver="/tesoreria/lotes" etiquetaVolver="Volver a Tesorería" modo="tesoreria" />
}
