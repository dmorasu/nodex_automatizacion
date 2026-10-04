import { requiereAcceso } from "@/src/auth/dal"
import { ROLES } from "@/src/auth/permisos"

// Usuarios y roles del módulo de gastos: solo administradores
export default async function UsuariosLayout({ children }: { children: React.ReactNode }) {
  await requiereAcceso([ROLES.ADMIN])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Usuarios</h1>
      {children}
    </div>
  )
}
