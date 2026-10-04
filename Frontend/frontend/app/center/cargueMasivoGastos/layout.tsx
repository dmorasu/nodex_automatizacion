import { requierePerfil } from "@/src/auth/dal"

// El cargue masivo de gastos lo hace Gestión de activos (y Admin)
export default async function SoloGestionActivosLayout({ children }: { children: React.ReactNode }) {
  await requierePerfil(["GESTION_ACTIVOS"])
  return <>{children}</>
}
