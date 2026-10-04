import clsx from "clsx"

// Colores por nombre de estado (los mismos del tablero de trámites)
const COLORES: Record<string, string> = {
  "sin iniciar": "bg-slate-50 text-slate-600 border-slate-200",
  "en curso": "bg-sky-50 text-sky-700 border-sky-200",
  "en espera por novedad": "bg-amber-50 text-amber-700 border-amber-200",
  "novedad subsanada continuar trámite": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "desistido": "bg-red-50 text-red-600 border-red-200",
  "finalizado": "bg-emerald-50 text-emerald-700 border-emerald-200"
}

// Indicador del estado de un trámite
export default function EstadoTramite({ nombre, grande }: { nombre: string | null | undefined, grande?: boolean }) {
  const texto = nombre ?? "Sin iniciar"
  return (
    <span className={clsx(
      "inline-flex items-center whitespace-nowrap rounded-full border font-semibold",
      grande ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
      COLORES[texto.toLowerCase().trim()] ?? "bg-slate-50 text-slate-600 border-slate-200"
    )}>
      {texto}
    </span>
  )
}
