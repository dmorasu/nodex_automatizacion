import { obtenerReembolso } from "@/src/lib/datosCajaMenor"
import DetalleReembolso from "@/components/cajaMenor/DetalleReembolso"

export default async function ReembolsoCajaPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const reembolso = await obtenerReembolso(Number(params.id))
  return (
    <DetalleReembolso
      reembolso={reembolso}
      volver={{ href: `/tesoreria/caja-menor?caja=${reembolso.bolsa.id}&vista=reembolsos`, texto: "Volver a la caja" }}
    />
  )
}
