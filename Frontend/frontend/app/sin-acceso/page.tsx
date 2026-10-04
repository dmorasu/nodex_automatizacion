import { ShieldX } from "lucide-react"
import { cerrarSesion } from "@/actions/cerrarSesion"

// Usuarios sin perfil de trámites (Gestión de activos o Torre de control)
export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-slate-50">
      <ShieldX size={40} className="text-red-400" />
      <h1 className="text-lg font-semibold text-slate-700">Aún no tienes un perfil asignado</h1>
      <p className="max-w-md text-sm text-slate-500">
        Para usar el módulo de trámites necesitas el perfil <b>Gestión de activos</b> o <b>Torre de control</b>.
        Pide al administrador que te lo asigne en la Administración de Nodex Gastos.
      </p>
      <form action={cerrarSesion}>
        <button type="submit" className="mt-2 px-4 py-2 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600">
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}
