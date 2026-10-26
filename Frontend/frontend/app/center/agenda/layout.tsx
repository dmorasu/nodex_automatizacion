import { requierePerfil } from "@/src/auth/dal"

// Torre de control y Gestión de activos (que solo consulta y aparta espacios)
export default async function AgendaLayout({ children }: { children: React.ReactNode }) {
  await requierePerfil(["TORRE_CONTROL", "GESTION_ACTIVOS"])
  return <>{children}</>
}
