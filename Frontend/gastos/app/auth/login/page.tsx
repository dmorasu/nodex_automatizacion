import LoginForm from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">

      <div className="mb-9">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
          Nodex Gastos
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Ingresa con el mismo usuario y contraseña del{" "}
          <span className="font-medium text-slate-600">módulo de trámites</span>.
        </p>

        <div className="mt-6 h-px w-full bg-slate-200" />
      </div>

      <LoginForm />

    </div>
  )
}
