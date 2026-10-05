import { Suspense } from "react"
import DashboardSolicitudesPage from "@/components/solicitudTramites/DashboardSolicitudes"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Nodex - Inicio",
}

// Los datos los carga DashboardSolicitudes (con filtros en la URL) a través del proxy /api/backend
export default function CenterPage() {
  return (
    <Suspense>
      <DashboardSolicitudesPage />
    </Suspense>
  )
}
