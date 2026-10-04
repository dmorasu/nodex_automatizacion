import LoginForm from "@/components/auth/LoginForm"

export default function LoginPage({ searchParams }: { searchParams: { sesion?: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-slate-500">
        Su usuario es su número de identificación. Si no tiene contraseña, pídala a Torre de control.
      </p>

      {searchParams.sesion === "cerrada" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Su sesión se cerró. Ingrese de nuevo.
        </p>
      )}

      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  )
}
