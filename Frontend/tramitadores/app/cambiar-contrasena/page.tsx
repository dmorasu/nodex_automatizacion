import Link from "next/link"
import { KeyRound } from "lucide-react"
import { obtenerSesion } from "@/src/auth/sesion"
import CambioContrasenaForm from "@/components/auth/CambioContrasenaForm"

// Obligatoria con la contraseña temporal; después se puede usar cuando quiera
export default async function CambiarContrasenaPage() {
  const sesion = await obtenerSesion()

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <KeyRound size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-slate-800">
          {sesion.debeCambiarContrasena ? "Cree su contraseña" : "Cambiar contraseña"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {sesion.debeCambiarContrasena
            ? `Hola ${sesion.nombre}. Antes de continuar, reemplace la contraseña temporal por una que solo usted conozca.`
            : "Al cambiarla se cierran sus sesiones en otros dispositivos."}
        </p>

        <div className="mt-6">
          <CambioContrasenaForm temporal={sesion.debeCambiarContrasena} />
        </div>

        {!sesion.debeCambiarContrasena && (
          <Link href="/inicio" className="mt-6 block text-center text-sm font-semibold text-indigo-600">Volver</Link>
        )}
      </div>
    </main>
  )
}
