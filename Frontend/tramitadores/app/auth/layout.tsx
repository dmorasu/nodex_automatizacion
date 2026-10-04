import Image from "next/image"

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-indigo-600 via-indigo-700 to-slate-900">
      <div className="flex flex-col items-center px-6 pt-12 pb-8 text-center">
        <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10">
          <Image src="/nodex.png" alt="Nodex" width={180} height={45} priority />
        </div>
        <p className="mt-4 text-sm font-semibold text-white">Nodex Tramitadores</p>
        <p className="mt-1 text-xs text-indigo-100/80">Sus trámites, gastos y soportes en el celular</p>
      </div>

      <div className="flex-1 rounded-t-3xl bg-slate-50 px-5 pt-8 pb-10">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
