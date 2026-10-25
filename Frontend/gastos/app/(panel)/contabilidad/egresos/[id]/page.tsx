import DetalleLote from "@/components/tesoreria/DetalleLote"

export default async function EgresoLotePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <DetalleLote id={Number(params.id)} rutaVolver="/contabilidad" etiquetaVolver="Volver a egresos" modo="contabilidad" />
}
