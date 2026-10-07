import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

export default async function ContabilidadLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.CONTABILIDAD])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Contabilidad</h1>
        <p className="mt-1 text-sm text-slate-400">
          Registre el número de egreso de los pagos, contabilice las cuentas de cobro legalizadas, lleve los gastos
          no reembolsables (factura y contabilización) y confirme los anticipos de los clientes con su recibo de caja.
        </p>
      </div>

      <Pestanas
        pestanas={[
          { href: "/contabilidad", nombre: "Egresos" },
          { href: "/contabilidad/anticipos", nombre: "Anticipos de clientes" },
          { href: "/contabilidad/por-contabilizar", nombre: "Cuentas por contabilizar" },
          { href: "/contabilidad/no-reembolsables", nombre: "No reembolsables" },
          { href: "/contabilidad/cuentas", nombre: "Cuentas de cobro" },
          { href: "/contabilidad/reintegros-tramitador", nombre: "Reintegros por tramitador" },
          { href: "/contabilidad/clientes-empresariales", nombre: "Clientes empresariales" }
        ]}
      />

      {children}
    </div>
  )
}
