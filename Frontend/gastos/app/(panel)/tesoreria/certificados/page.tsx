import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import BandejaPorPagar from "@/components/tesoreria/BandejaPorPagar"

// Compras de certificados (CTL, Cámara de Comercio y RUNT) por pagar: solo Tesorería - Certificados
// (y el administrador). Tienen la misma lógica después del pago: los reembolsables van a
// Legalización y los no reembolsables afectan la bolsa y siguen a Contabilidad.
export default async function CertificadosPage({ searchParams }: { searchParams: { bolsaId?: string, busqueda?: string } }) {
  await requiereAcceso([ROLES.TESORERIA_CERTIFICADOS])

  return (
    <div className="space-y-4">
      <BandejaPorPagar tipo="certificados" searchParams={searchParams} />
    </div>
  )
}
