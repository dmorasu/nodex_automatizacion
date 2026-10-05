import { requierePerfil } from "@/src/auth/dal"

// Sección exclusiva del perfil Torre de control
export default async function SoloTorreControlLayout({ children }: { children: React.ReactNode }) {
  await requierePerfil(["TORRE_CONTROL"])
  return <>{children}</>
}
