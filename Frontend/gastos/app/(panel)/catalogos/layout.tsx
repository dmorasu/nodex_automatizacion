import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"
import { CATALOGOS } from "@/src/lib/catalogos"
import Pestanas from "@/components/ui/Pestanas"

// Catálogos de Nodex Gastos: solo administradores
export default async function CatalogosLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.ADMIN])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Catálogos</h1>
      </div>

      <Pestanas pestanas={[
        ...CATALOGOS.map(c => ({ href: c.ruta ? `/catalogos/${c.ruta}` : "/catalogos", nombre: c.nombre })),
        { href: "/catalogos/programacion", nombre: "Programación de pagos" }
      ]} />

      {children}
    </div>
  )
}
