import Link from "next/link"

export default function NoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl font-semibold text-indigo-600">404</p>
      <p className="mt-2 text-sm text-slate-600">No encontramos lo que busca o no está asignado a usted.</p>
      <Link href="/inicio" className="mt-6 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Ir al inicio</Link>
    </main>
  )
}
