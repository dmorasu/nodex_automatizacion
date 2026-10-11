import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

export default async function ContabilidadLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.CONTABILIDAD])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Contabilidad</h1>
      </div>

      <Pestanas
        pestanas={[
          { href: "/contabilidad", nombre: "Egresos" },
          { href: "/contabilidad/anticipos", nombre: "Anticipos de clientes" },
          { href: "/contabilidad/facturas", nombre: "Solicitudes de factura" },
          { href: "/contabilidad/por-contabilizar", nombre: "Cuentas por contabilizar" },
          { href: "/contabilidad/no-reembolsables", nombre: "No reembolsables" },
          { href: "/contabilidad/cuentas", nombre: "Cuentas de cobro" },
          { href: "/contabilidad/reintegros-tramitador", nombre: "Reintegros por tramitador" }
        ]}
      />

      {children}
    </div>
  )
}
