import DetalleLote from "@/components/tesoreria/DetalleLote"

export default function EgresoLotePage({ params }: { params: { id: string } }) {
  return <DetalleLote id={Number(params.id)} rutaVolver="/contabilidad" etiquetaVolver="Volver a egresos" modo="contabilidad" />
}
