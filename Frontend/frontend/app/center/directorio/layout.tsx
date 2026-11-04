import { requierePerfil } from "@/src/auth/dal"

// Torre de control, administradores y Analista de trámites (todos tienen el perfil Torre de control)
export default async function DirectorioLayout({ children }: { children: React.ReactNode }) {
  await requierePerfil(["TORRE_CONTROL"])
  return <>{children}</>
}
