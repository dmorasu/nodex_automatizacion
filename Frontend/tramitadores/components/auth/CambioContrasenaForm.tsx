"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "react-toastify"
import { Check } from "lucide-react"
import { cambiarContrasena } from "@/actions/sesion"
import { claseBotonPrimario, claseInput, claseLabel } from "../ui/estilos"
import RequisitosContrasena from "./RequisitosContrasena"

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${claseBotonPrimario} w-full`}>
      <Check size={16} />
      {pending ? "Guardando..." : "Guardar contraseña"}
    </button>
  )
}

export default function CambioContrasenaForm({ temporal }: { temporal: boolean }) {
  const [estado, enviar] = useActionState(cambiarContrasena, { errors: [] })
  const [nueva, setNueva] = useState("")

  useEffect(() => {
    estado.errors.forEach(error => toast.error(error))
  }, [estado])

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <label className="block">
        <span className={claseLabel}>{temporal ? "Contraseña temporal" : "Contraseña actual"}</span>
        <input name="contrasenaActual" type="password" autoComplete="current-password" className={claseInput} />
      </label>
      <label className="block">
        <span className={claseLabel}>Nueva contraseña</span>
        <input name="contrasena" type="password" autoComplete="new-password" className={claseInput}
          value={nueva} onChange={e => setNueva(e.target.value)} />
        <RequisitosContrasena contrasena={nueva} />
        <span className="mt-1 block text-[11px] text-slate-400">No use su cédula ni su nombre.</span>
      </label>
      <label className="block">
        <span className={claseLabel}>Repita la nueva contraseña</span>
        <input name="confirmacion" type="password" autoComplete="new-password" className={claseInput} />
      </label>
      <BotonGuardar />
    </form>
  )
}
