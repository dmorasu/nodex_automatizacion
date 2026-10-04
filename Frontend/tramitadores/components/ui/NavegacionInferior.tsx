"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, House, Route, Undo2 } from "lucide-react"

const SECCIONES = [
  { href: "/inicio", nombre: "Inicio", Icono: House },
  { href: "/tramites", nombre: "Trámites", Icono: ClipboardList },
  { href: "/gastos", nombre: "Reintegros", Icono: Undo2 }
]

// Barra fija abajo, al alcance del pulgar. Los mensajeros ven además "Mi ruta".
export default function NavegacionInferior({ esMensajero = false }: { esMensajero?: boolean }) {
  const ruta = usePathname()
  const secciones = esMensajero
    ? [SECCIONES[0], { href: "/ruta", nombre: "Mi ruta", Icono: Route }, ...SECCIONES.slice(1)]
    : SECCIONES

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className={`mx-auto grid max-w-2xl ${secciones.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {secciones.map(({ href, nombre, Icono }) => {
          const activa = ruta === href || ruta.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${activa ? "text-indigo-600" : "text-slate-400 active:text-slate-600"}`}
              >
                <Icono size={22} strokeWidth={activa ? 2.4 : 1.8} />
                {nombre}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
