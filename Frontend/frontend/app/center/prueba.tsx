import { encabezadosSesion } from "@/src/lib/sesionApi"
import Link from "next/link"
import { formatoFecha } from "@/src/ultis"
import { SolicitudesAPIRespuestaSchema } from "@/src/schemas"
import PaginatedTable from "@/components/solicitudTramites/PaginaTedTable"


export const metadata = {
  title: "Nodex - Centro de Solicitudes",
}

async function getSolicitudes() {
  const url = `${process.env.API_URL}/solicitudTramites`
  const res = await fetch(url, { cache: "no-store", headers: encabezadosSesion() })
  if (!res.ok) throw new Error("Error al cargar solicitudes")
  const data = await res.json()
  return SolicitudesAPIRespuestaSchema.parse(data)
}

export default async function CenterPage() {
  const solicitudes = await getSolicitudes()
  const pageSize = 5
  const totalPages = Math.ceil(solicitudes.length / pageSize)

  return (
    <div className="container mx-auto mt-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Solicitudes</h1>
        <Link
          href="/center/create"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Nueva Solicitud
        </Link>
      </div>

   
    </div>
  )
}