import { z } from "zod"
import TablaUsuariosRoles from "@/components/admin/TablaUsuariosRoles"
import { fetchApi } from "@/src/lib/api"
import { RolSchema, UsuarioConRolesSchema } from "@/src/schemas/admin"

// La sesión de administrador se exige en el layout
export default async function UsuariosRolesPage() {
  const [reqUsuarios, reqRoles] = await Promise.all([
    fetchApi("/gastos/admin/usuarios"),
    fetchApi("/gastos/admin/roles")
  ])

  const usuarios = z.array(UsuarioConRolesSchema).parse(await reqUsuarios.json())
  const roles = z.array(RolSchema).parse(await reqRoles.json())

  return (
    <div>

      <div className="mt-6">
        <TablaUsuariosRoles usuarios={usuarios} roles={roles} />
      </div>
    </div>
  )
}
