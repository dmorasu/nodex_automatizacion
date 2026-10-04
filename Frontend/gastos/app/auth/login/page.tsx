import LoginForm from "@/components/auth/LoginForm"
import { ShieldCheck } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">

      <div className="mb-9">
        <div className="
          inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full
          bg-emerald-50 border border-emerald-100
          text-[10px] font-semibold uppercase tracking-wider text-emerald-600
        ">
          <ShieldCheck size={13} />
          Acceso seguro
        </div>

        <h1 className="
          text-3xl sm:text-4xl font-semibold tracking-tight
          bg-gradient-to-r from-slate-800 via-slate-700 to-emerald-500
          bg-clip-text text-transparent
        ">
          Nodex Gastos
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Ingresa con el mismo usuario y contraseña del{" "}
          <span className="font-medium text-slate-600">módulo de trámites</span>.
        </p>

        <div className="mt-6 h-px w-full bg-gradient-to-r from-emerald-400 via-slate-200 to-transparent" />
      </div>

      <LoginForm />

    </div>
  )
}
