import CenterPageClient from "@/components/solicitudTramites/CenterPageClient"
import { Metadata } from "next"
import { cookies } from "next/headers"

export const metadata: Metadata = {
  title: "Nodex - Inicio",
}

// 🔹 Carga de solicitudes desde backend con paginación y búsqueda
async function getSolicitudes(searchParams: any) {
  const query = new URLSearchParams()

  if (searchParams.page) query.append("page", searchParams.page)
  if (searchParams.search) query.append("search", searchParams.search)

  const url = `${process.env.API_URL}/solicitudTramites?${query.toString()}`
  // Con la sesión, Gestión de activos recibe solo los trámites que creó
  const req = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${cookies().get("TOKEN")?.value}` }
  })
  const json = await req.json()

  return json
}

export default async function CenterPage({ searchParams }: { searchParams: any }) {
  const response = await getSolicitudes(searchParams)

  return (
    <CenterPageClient
      solicitudes={response.data}
      totalPages={response.totalPages}
      currentPage={response.currentPage}
      searchInitial={searchParams.search || ""}
    />
  )
}
