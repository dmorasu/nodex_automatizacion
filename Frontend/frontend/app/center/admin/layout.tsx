import { requiereAdmin } from "@/src/auth/dal"

// Administración: solo el rol Admin
export default async function SoloAdminLayout({ children }: { children: React.ReactNode }) {
  await requiereAdmin()
  return <>{children}</>
}
