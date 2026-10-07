import { Metadata } from "next"
import { FileUp } from "lucide-react"
import CargueDocumentos from "@/components/cargueMasiva/CargueDocumentos"

export const metadata: Metadata = {
  title: "Nodex - Cargue masivo de documentos",
}

// Documentos de varios trámites a la vez: el número del trámite sale del nombre del archivo.
// ?tramites=1,2,3 llega desde el cargue masivo de trámites (los recién creados)
export default function CargueDocumentosPage({ searchParams }: { searchParams: { tramites?: string } }) {
  const recientes = (searchParams.tramites ?? "").split(",").map(Number).filter(n => n > 0).slice(0, 300)

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
            <FileUp size={18} className="text-sky-500" />
          </span>
          <h1 className="text-xl font-semibold text-slate-800">Cargue masivo de documentos</h1>
        </div>
        <p className="ml-11 mt-1 text-xs text-slate-400">
          Suba los documentos de muchos trámites a la vez. Cada archivo va al trámite cuyo número lleva en el nombre; revise la tabla antes de subir.
        </p>
      </div>
      <CargueDocumentos recientes={recientes} />
    </div>
  )
}
