import { Metadata } from "next"
import { ShieldCheck } from "lucide-react"
import { verificacionSesion } from "@/src/auth/dal"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import AdministracionUsuarios, { type Rol, type UsuarioAdmin } from "@/components/administracion/AdministracionUsuarios"

export const metadata: Metadata = {
  title: "Nodex - Administración",
}

export default async function AdministracionPage() {
  const { usuario, esAdmin } = await verificacionSesion()

  const [reqUsuarios, reqRoles] = await Promise.all([
    fetch(`${process.env.API_URL}/gastos/admin/usuarios`, { headers: encabezadosSesion(), cache: "no-store" }),
    fetch(`${process.env.API_URL}/gastos/admin/roles`, { headers: encabezadosSesion(), cache: "no-store" })
  ])

  const usuarios: UsuarioAdmin[] = reqUsuarios.ok ? await reqUsuarios.json() : []
  const roles: Rol[] = reqRoles.ok ? await reqRoles.json() : []

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50">
          <ShieldCheck className="text-sky-500" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Administración</h1>
          <p className="text-xs text-slate-500">
            {esAdmin
              ? "Usuarios y perfiles de Nodex Trámites y Nodex Gastos. Sin un perfil de trámites (o Admin) el usuario no puede entrar a trámites."
              : "Usuarios y perfiles de Nodex Trámites. Los perfiles de Gastos y Administración los asigna el administrador."}
          </p>
        </div>
      </div>

      <AdministracionUsuarios usuarios={usuarios} roles={roles} usuarioActualId={usuario.id} soloTramites={!esAdmin} />
    </div>
  )
}
