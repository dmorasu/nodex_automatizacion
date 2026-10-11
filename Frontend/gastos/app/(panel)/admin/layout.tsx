import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"

// Panel de administración (todos los gastos): solo administradores
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.ADMIN])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Tablero de Control</h1>
      </div>
      {children}
    </div>
  )
}
