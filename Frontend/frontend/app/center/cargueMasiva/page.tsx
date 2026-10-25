import Link from "next/link"
import { Metadata } from "next"
import clsx from "clsx"
import { ArrowLeft, Upload } from "lucide-react"
import CargueEnPantalla from "@/components/cargueMasiva/CargueEnPantalla"
import CargaMasivaSolicitudes from "@/components/cargueMasiva/cargueMasivaForm"

export const metadata: Metadata = {
  title: "Nodex - Cargue Masivo",
  description: "Nodex - Cargue Masivo de Solicitudes",
}

// Cargue masivo de trámites: en pantalla (por nombres, con validación fila por fila y gastos
// en la misma fila) o con el Excel de ids de siempre
export default async function CargueMasivoPage(props: { searchParams: Promise<{ modo?: string }> }) {
  const searchParams = await props.searchParams
  const modo = searchParams.modo === "excel" ? "excel" : "pantalla"

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50">
              <Upload size={18} className="text-sky-500" />
            </span>
            <h1 className="text-xl font-semibold text-slate-800">Cargue masivo de trámites</h1>
          </div>
          <p className="ml-11 mt-1 text-xs text-slate-400">
            Cree muchos trámites a la vez (y sus gastos, si los tienen). Escriba las filas, péguelas desde Excel o importe el archivo; valide y guarde.
          </p>
        </div>
        <Link href="/center/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={14} /> Volver al Dashboard
        </Link>
      </div>

      <nav className="flex border-b border-slate-200">
        {[["pantalla", "En pantalla"], ["excel", "Excel con IDs (anterior)"]].map(([clave, nombre]) => (
          <Link
            key={clave}
            href={clave === "excel" ? "/center/cargueMasiva?modo=excel" : "/center/cargueMasiva"}
            aria-current={modo === clave ? "page" : undefined}
            className={clsx("-mb-px border-b-2 px-4 py-2.5 text-xs font-semibold",
              modo === clave ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-700")}
          >
            {nombre}
          </Link>
        ))}
      </nav>

      {modo === "pantalla" ? <CargueEnPantalla /> : <CargaMasivaSolicitudes />}
    </div>
  )
}
