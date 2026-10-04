import Link from "next/link"
import { ShieldX } from "lucide-react"

export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldX size={40} className="text-red-400" />
      <h1 className="text-lg font-semibold text-slate-700">No tienes acceso a este módulo</h1>
      <p className="max-w-sm text-sm text-slate-400">
        Si necesitas entrar, pide al administrador del módulo de gastos que te asigne el rol correspondiente.
      </p>
      <Link
        href="/inicio"
        className="mt-2 px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
