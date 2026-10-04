import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

export default async function LegalizacionLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.LEGALIZACION])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Legalización</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gastos reembolsables ya pagados: registre su factura, agrúpelos en cuentas de cobro y gestione los reintegros.
          Los no reembolsables los lleva Contabilidad.
        </p>
      </div>

      <Pestanas
        pestanas={[
          { href: "/legalizacion", nombre: "Gastos sin factura" },
          { href: "/legalizacion/facturados", nombre: "Gastos con factura" },
          { href: "/legalizacion/carga-facturas", nombre: "Carga masiva de facturas" },
          { href: "/legalizacion/cuentas", nombre: "Cuentas de cobro" },
          { href: "/legalizacion/soportes", nombre: "Soportes de tramitadores" },
          { href: "/legalizacion/reintegros", nombre: "Reintegros" },
          { href: "/legalizacion/reintegros-tramitador", nombre: "Reintegros por tramitador" },
          { href: "/legalizacion/descargas", nombre: "Descargar documentos" }
        ]}
      />

      {children}
    </div>
  )
}
