import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import BandejaPorPagar from "@/components/tesoreria/BandejaPorPagar"

// Compras de certificados (CTL y Cámara de Comercio) por pagar: solo Tesorería - Certificados
// (y el administrador). Tienen la misma lógica después del pago: los reembolsables van a
// Legalización y los no reembolsables afectan la bolsa y siguen a Contabilidad.
export default async function CertificadosPage({ searchParams }: { searchParams: { bolsaId?: string, busqueda?: string } }) {
  await requiereAcceso([ROLES.TESORERIA_CERTIFICADOS])

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Compras de CTL y certificados de Cámara de Comercio por pagar. No aparecen en el &quot;Por pagar&quot; general de Tesorería.
      </p>
      <BandejaPorPagar tipo="certificados" searchParams={searchParams} />
    </div>
  )
}
