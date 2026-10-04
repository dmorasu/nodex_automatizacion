"use client"

import { useEffect } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { toast } from "react-toastify"
import { Check } from "lucide-react"
import { cambiarContrasena } from "@/actions/sesion"
import { claseBotonPrimario, claseInput, claseLabel } from "../ui/estilos"

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
  const [estado, enviar] = useFormState(cambiarContrasena, { errors: [] })

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
        <input name="contrasena" type="password" autoComplete="new-password" className={claseInput} />
        <span className="mt-1 block text-[11px] text-slate-400">Mínimo 8 caracteres, con letras y números. No use su cédula.</span>
      </label>
      <label className="block">
        <span className={claseLabel}>Repita la nueva contraseña</span>
        <input name="confirmacion" type="password" autoComplete="new-password" className={claseInput} />
      </label>
      <BotonGuardar />
    </form>
  )
}
