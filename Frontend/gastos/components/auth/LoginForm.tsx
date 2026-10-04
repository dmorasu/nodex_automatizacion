"use client"

import { useEffect } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { toast } from "react-toastify"
import { Mail, LockKeyhole, LogIn } from "lucide-react"
import { iniciarSesion } from "@/actions/iniciarSesion"

const claseInput = `
  w-full h-10 px-3 rounded-md border border-slate-200 bg-white
  text-xs text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100
`

const claseLabel = "flex items-center gap-2 text-xs font-semibold text-slate-600"

function BotonIngresar() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="
        w-full h-10 flex items-center justify-center gap-2 rounded-md shadow-sm
        bg-emerald-600 text-white text-xs font-semibold transition
        hover:bg-emerald-700 disabled:opacity-60
        focus:outline-none focus:ring-2 focus:ring-emerald-200
      "
    >
      <LogIn size={15} />
      {pending ? "Ingresando..." : "Iniciar sesión"}
    </button>
  )
}

export default function LoginForm() {
  const [state, dispatch] = useFormState(iniciarSesion, { errors: [] })

  useEffect(() => {
    state.errors.forEach(error => toast.error(error))
  }, [state])

  return (
    <form action={dispatch} className="space-y-5" noValidate>

      <div className="space-y-2">
        <label htmlFor="correoUsuario" className={claseLabel}>
          <Mail size={14} className="text-emerald-500" />
          Correo electrónico
        </label>
        <input
          id="correoUsuario"
          name="correoUsuario"
          type="email"
          placeholder="correo@empresa.com"
          autoComplete="email"
          className={claseInput}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="contrasena" className={claseLabel}>
          <LockKeyhole size={14} className="text-emerald-500" />
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          placeholder="Ingresa tu contraseña"
          autoComplete="current-password"
          className={claseInput}
        />
      </div>

      <BotonIngresar />

    </form>
  )
}
