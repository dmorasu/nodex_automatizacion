import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import Pestanas from "@/components/ui/Pestanas"

export default async function LegalizacionLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.LEGALIZACION])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Legalización</h1>
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
