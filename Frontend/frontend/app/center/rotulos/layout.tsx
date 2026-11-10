import { requierePerfil } from "@/src/auth/dal"

// Torre de control, administradores, Analista de trámites y, desde el 2026-11-10, Gestión de activos
// (decisión del usuario). En los rótulos, Gestión de activos solo usa los trámites de su área (lo filtra el backend)
export default async function RotulosLayout({ children }: { children: React.ReactNode }) {
  await requierePerfil(["TORRE_CONTROL", "GESTION_ACTIVOS"])
  return <>{children}</>
}
