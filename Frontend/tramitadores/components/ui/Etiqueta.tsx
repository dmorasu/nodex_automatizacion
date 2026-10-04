import clsx from "clsx"

const TONOS = {
  gris: "border-slate-200 bg-slate-50 text-slate-600",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  verde: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ambar: "border-amber-200 bg-amber-50 text-amber-800",
  rojo: "border-red-200 bg-red-50 text-red-700"
}

export type Tono = keyof typeof TONOS

export default function Etiqueta({ tono = "gris", children }: { tono?: Tono, children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight", TONOS[tono])}>
      {children}
    </span>
  )
}

// Color del estado del trámite (el texto siempre dice el estado; el color solo acompaña)
export const tonoEstadoTramite = (estado: string | null | undefined): Tono => {
  switch (estado) {
    case "Finalizado": return "verde"
    case "Desistido": return "gris"
    case "En espera por novedad": return "ambar"
    case "En Curso":
    case "Novedad Subsanada Continuar Trámite": return "indigo"
    default: return "gris"
  }
}
