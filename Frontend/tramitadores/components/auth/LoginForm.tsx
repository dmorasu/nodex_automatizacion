"use client"

import { useEffect } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { toast } from "react-toastify"
import { IdCard, LockKeyhole, LogIn } from "lucide-react"
import { iniciarSesion } from "@/actions/sesion"
import { claseBotonPrimario, claseInput, claseLabel } from "../ui/estilos"

function BotonIngresar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${claseBotonPrimario} w-full`}>
      <LogIn size={16} />
      {pending ? "Ingresando..." : "Ingresar"}
    </button>
  )
}

export default function LoginForm() {
  const [estado, enviar] = useFormState(iniciarSesion, { errors: [] })

  useEffect(() => {
    estado.errors.forEach(error => toast.error(error))
  }, [estado])

  return (
    <form action={enviar} className="space-y-5" noValidate>
      <label className="block">
        <span className={`${claseLabel} flex items-center gap-2`}>
          <IdCard size={14} className="text-indigo-500" />
          Identificación
        </span>
        <input
          name="identificacion"
          inputMode="numeric"
          autoComplete="username"
          placeholder="Número de cédula"
          className={claseInput}
        />
      </label>

      <label className="block">
        <span className={`${claseLabel} flex items-center gap-2`}>
          <LockKeyhole size={14} className="text-indigo-500" />
          Contraseña
        </span>
        <input
          name="contrasena"
          type="password"
          autoComplete="current-password"
          placeholder="Su contraseña"
          className={claseInput}
        />
      </label>

      <BotonIngresar />
    </form>
  )
}
