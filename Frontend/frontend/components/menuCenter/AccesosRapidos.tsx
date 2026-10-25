"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import { CircleCheckBig, FilePlus2, LayoutDashboard, Radar, Route, Settings2, type LucideIcon } from "lucide-react"

import type { PerfilTramites } from "@/src/auth/perfiles"

type Acceso = { href: string, nombre: string, icono: LucideIcon, visible: boolean }

// Accesos del encabezado (siempre a la vista, el encabezado queda fijo al bajar): pasar del
// Dashboard al Tablero de gestión, a la gestión masiva o a un trámite nuevo sin abrir el menú.
// Mismos permisos del menú.
export default function AccesosRapidos({ perfil }: { perfil: PerfilTramites }) {
  const ruta = usePathname()
  const esTorreControl = perfil === "TORRE_CONTROL"

  const accesos: Acceso[] = [
    { href: "/center/dashboard", nombre: "Dashboard", icono: LayoutDashboard, visible: true },
    { href: "/center/torreControl", nombre: "Tablero de gestión", icono: Radar, visible: esTorreControl },
    { href: "/center/reportesRealizado", nombre: "Realizados", icono: CircleCheckBig, visible: esTorreControl },
    { href: "/center/rutas", nombre: "Rutas", icono: Route, visible: esTorreControl },
    { href: "/center/gestionMasiva", nombre: "Gestión masiva", icono: Settings2, visible: esTorreControl },
    { href: "/center/solicitudTramites/nueva", nombre: "Nuevo trámite", icono: FilePlus2, visible: true }
  ]

  return (
    <nav aria-label="Accesos rápidos" className="flex items-center gap-1">
      {accesos.filter(a => a.visible).map(({ href, nombre, icono: Icono }) => {
        const activo = ruta === href || ruta.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            title={nombre}
            className={clsx(
              "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
              activo ? "bg-sky-50 font-semibold text-sky-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icono size={16} className={clsx("shrink-0", activo ? "text-sky-600" : "text-slate-400")} />
            {/* En pantallas medianas solo el ícono (el nombre sale al pasar el mouse) */}
            <span className="hidden lg:inline">{nombre}</span>
          </Link>
        )
      })}
    </nav>
  )
}
