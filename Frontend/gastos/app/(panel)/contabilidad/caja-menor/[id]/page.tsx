import { obtenerReembolso } from "@/src/lib/datosCajaMenor"
import DetalleReembolso from "@/components/cajaMenor/DetalleReembolso"

export default async function ReembolsoContabilidadPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const reembolso = await obtenerReembolso(Number(params.id))
  return <DetalleReembolso reembolso={reembolso} volver={{ href: "/contabilidad/caja-menor", texto: "Volver a cajas menores" }} />
}
