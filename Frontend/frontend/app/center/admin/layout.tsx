import { requiereAdministrarUsuarios } from "@/src/auth/dal"

// Administración: Admin, o Administrador de Torre de control (solo perfiles de trámites)
export default async function AdministracionLayout({ children }: { children: React.ReactNode }) {
  await requiereAdministrarUsuarios()
  return <>{children}</>
}
