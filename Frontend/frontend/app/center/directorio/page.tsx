import { Metadata } from "next"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import type { DatosDirectorio } from "@/src/directorio"
import DirectorioTramitadores from "@/components/directorio/DirectorioTramitadores"

export const metadata: Metadata = {
  title: "Nodex - Directorio de tramitadores",
}

// Directorio de tramitadores (Ayudas Torre de Control): quién atiende cada municipio y cómo
// contactarlo. Los datos salen de Catálogos → Tramitadores (solo activos)
export default async function DirectorioPage(props: { searchParams: Promise<{ vista?: string, municipio?: string }> }) {
  const p = await props.searchParams
  let datos: DatosDirectorio | null = null
  try {
    const req = await fetch(`${process.env.API_URL}/directorio`, { headers: await encabezadosSesion(), cache: "no-store" })
    datos = req.ok ? await req.json() : null
  } catch {
    datos = null
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Directorio de tramitadores</h1>
        <p className="mt-1 text-sm text-slate-400">Quién atiende cada municipio y cómo contactarlo. Los datos se editan en Catálogos → Tramitadores.</p>
      </div>
      {datos
        ? <DirectorioTramitadores datos={datos} vistaInicial={p.vista} municipioInicial={Number(p.municipio) || null} />
        : <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudo cargar el directorio.</p>}
    </div>
  )
}
