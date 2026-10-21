import Image from "next/image"
import Link from "next/link"
import { requiereSesion } from "@/src/auth/sesion"
import MenuCuenta from "@/components/ui/MenuCuenta"
import NavegacionInferior from "@/components/ui/NavegacionInferior"
import RegistroServiceWorker from "@/components/notificaciones/RegistroServiceWorker"
import UbicacionEnRuta from "@/components/ruta/UbicacionEnRuta"

// Estructura de la app en el celular: encabezado arriba y navegación fija abajo
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sesion = await requiereSesion()

  return (
    <div className="min-h-screen w-full pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          {/* Logo de Nodex Tramitadores (lleva al inicio) */}
          <Link href="/inicio" className="flex min-w-0 items-center gap-2" aria-label="Nodex Tramitadores · Inicio">
            <Image src="/nodextramitador.png" alt="" width={2075} height={758} priority className="h-9 w-auto shrink-0" />
            <span className="truncate text-sm font-semibold text-slate-800">Nodex Tramitadores</span>
          </Link>
          <MenuCuenta nombre={sesion.nombre} identificacion={sesion.identificacion} />
        </div>
        {/* Mensajero con la ruta iniciada: envía su ubicación y lo avisa aquí, en toda la app */}
        {sesion.esMensajero && <UbicacionEnRuta />}
      </header>

      <main className="mx-auto w-full min-w-0 max-w-2xl px-4 py-5">{children}</main>

      <NavegacionInferior esMensajero={sesion.esMensajero} />
      <RegistroServiceWorker />
    </div>
  )
}
