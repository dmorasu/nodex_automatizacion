import { obtenerReembolso } from "@/src/lib/datosCajaMenor"
import DetalleReembolso from "@/components/cajaMenor/DetalleReembolso"

export default async function ReembolsoDireccionPage({ params }: { params: { id: string } }) {
  const reembolso = await obtenerReembolso(Number(params.id))
  return <DetalleReembolso reembolso={reembolso} volver={{ href: "/direccion/caja-menor", texto: "Volver a reembolsos de caja menor" }} />
}
