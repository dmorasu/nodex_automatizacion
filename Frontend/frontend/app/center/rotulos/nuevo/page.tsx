import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import { verificacionSesion } from "@/src/auth/dal"
import type { OpcionesRotulo, TramiteParaRotulo } from "@/src/rotulos"
import GeneradorRotulo from "@/components/rotulos/GeneradorRotulo"

export const metadata: Metadata = {
  title: "Nodex - Nuevo rótulo de envío",
}

// Generador de rótulos (Ayudas Torre de Control). Con ?tramite=<id> se prellena con ese trámite
export default async function NuevoRotuloPage(props: { searchParams: Promise<{ tramite?: string }> }) {
  const p = await props.searchParams
  const tramiteId = Number(p.tramite) || null
  const { usuario } = await verificacionSesion()
  const headers = await encabezadosSesion()

  const [reqOpciones, reqTramite] = await Promise.all([
    fetch(`${process.env.API_URL}/rotulos/opciones`, { headers, cache: "no-store" }).catch(() => null),
    tramiteId ? fetch(`${process.env.API_URL}/rotulos/tramite/${tramiteId}`, { headers, cache: "no-store" }).catch(() => null) : null
  ])
  const opciones: OpcionesRotulo | null = reqOpciones?.ok ? await reqOpciones.json() : null
  const tramite: TramiteParaRotulo | null = reqTramite?.ok ? await reqTramite.json() : null

  return (
    <div className="space-y-5">
      <div>
        <Link href={tramite ? `/center/solicitudTramites/${tramite.id}` : "/center/rotulos"} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} /> {tramite ? `Volver al trámite #${tramite.id}` : "Rótulos de envío"}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">Nuevo rótulo de envío</h1>
        <p className="mt-1 text-sm text-slate-400">Complete los datos; la vista previa es el PDF tal como se imprimirá. Al generarlo queda en los documentos de los trámites.</p>
      </div>
      {tramiteId && !tramite && <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">No se encontró el trámite #{tramiteId}. Puede agregar los trámites en el formulario.</p>}
      {opciones
        ? <GeneradorRotulo opciones={opciones} tramiteInicial={tramite} usuario={usuario.nombreUsuario} />
        : <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudieron cargar los datos del rótulo.</p>}
    </div>
  )
}
