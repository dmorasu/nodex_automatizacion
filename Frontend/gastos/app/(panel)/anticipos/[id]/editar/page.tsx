import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import FormularioAnticipo from "@/components/anticipos/FormularioAnticipo"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerAnticipo, obtenerDatosFormularioAnticipo } from "@/src/lib/datosAnticipos"

export default async function EditarAnticipoPage({ params }: { params: { id: string } }) {
  await requiereAcceso([])
  const [anticipo, datos] = await Promise.all([obtenerAnticipo(Number(params.id)), obtenerDatosFormularioAnticipo()])

  if (!anticipo.permisos.editar) redirect(`/anticipos/${anticipo.id}`)

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/anticipos/${anticipo.id}`} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} />
          {anticipo.clase === "FACTURA" ? "Volver a la solicitud" : "Volver al anticipo"}
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-slate-800">
          {anticipo.estado === "NOVEDAD" ? "Corregir" : "Editar"} {anticipo.codigo}
        </h1>
      </div>

      <FormularioAnticipo {...datos} anticipo={anticipo} />
    </div>
  )
}
