import { requierePerfil } from "@/src/auth/dal"

// Sección exclusiva del perfil Torre de control (incluye analistas y su administrador)
export default async function RutasLayout({ children }: { children: React.ReactNode }) {
  await requierePerfil(["TORRE_CONTROL"])
  return <>{children}</>
}
