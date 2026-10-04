"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  Home,
  Receipt,
  Landmark,
  FileCheck2,
  Calculator,
  Settings2,
  BarChart3,
  FileSpreadsheet,
  Users,
  type LucideIcon
} from "lucide-react"
import type { Modulo } from "@/src/auth/permisos"

// Los íconos van aquí (y no en MODULOS) porque un componente no se puede
// pasar del servidor al cliente como prop
const ICONOS: Record<string, LucideIcon> = {
  "/inicio": Home,
  "/solicitudes": Receipt,
  "/tesoreria": Landmark,
  "/legalizacion": FileCheck2,
  "/contabilidad": Calculator,
  "/tablero": BarChart3,
  "/reportes": FileSpreadsheet,
  "/admin": Settings2,
  "/usuarios": Users
}

export default function Navegacion({ modulos }: { modulos: Modulo[] }) {
  const pathname = usePathname()

  const enlaces = [{ href: "/inicio", nombre: "Inicio" }, ...modulos]

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {enlaces.map(({ href, nombre }) => {
        const Icono = ICONOS[href]
        const activo = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition",
              activo
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            {Icono && <Icono size={15} />}
            {nombre}
          </Link>
        )
      })}
    </nav>
  )
}
