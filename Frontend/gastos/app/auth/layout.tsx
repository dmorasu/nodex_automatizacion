import Image from "next/image"

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-slate-50">

      {/* PANEL IZQUIERDO */}
      <div className="
        relative hidden lg:flex min-h-screen overflow-hidden
        bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900
      ">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative z-10 w-full flex flex-col items-center justify-center px-12">
          <div className="mb-10 p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-2xl">
            <Image src="/nodex.png" alt="Logo Nodex" width={400} height={100} priority />
          </div>

          <div className="max-w-sm text-center">
            <h2 className="text-xl font-semibold text-white">
              Módulo de Gestión de Gastos
            </h2>
            <p className="mt-3 text-xs leading-5 text-emerald-100/80">
              Solicitudes, pagos, legalizaciones y contabilización
              de los gastos en un solo lugar.
            </p>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="min-h-screen flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">

          <div className="flex justify-center mb-10 lg:hidden">
            <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
              <Image src="/nodexgastos.png" alt="Logo Nodex Gastos" width={240} height={88} priority />
            </div>
          </div>

          {children}

          <p className="mt-10 text-center text-[10px] text-slate-400">
            Nodex · Gestión de Gastos
          </p>
        </div>
      </div>

    </div>
  )
}
