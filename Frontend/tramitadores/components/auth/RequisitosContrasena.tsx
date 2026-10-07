import clsx from "clsx"
import { Check, Circle } from "lucide-react"
import { REGLAS_CONTRASENA } from "@/src/politicaContrasena"

// Requisitos de la contraseña, marcados a medida que se cumplen
export default function RequisitosContrasena({ contrasena }: { contrasena: string }) {
  return (
    <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-2" aria-label="Requisitos de la contraseña">
      {REGLAS_CONTRASENA.map(regla => {
        const cumple = regla.cumple(contrasena)
        return (
          <li key={regla.texto} className={clsx("flex items-center gap-1.5", cumple ? "text-emerald-700" : "text-slate-400")}>
            {cumple ? <Check size={12} strokeWidth={3} /> : <Circle size={10} />}
            {regla.texto}
          </li>
        )
      })}
    </ul>
  )
}
