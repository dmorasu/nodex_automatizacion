"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
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
  BadgeCheck,
  HandCoins,
  ChevronDown,
  type LucideIcon
} from "lucide-react"
import type { Modulo } from "@/src/auth/permisos"

// Los íconos van aquí (y no en MODULOS) porque un componente no se puede
// pasar del servidor al cliente como prop
const ICONOS: Record<string, LucideIcon> = {
  "/inicio": Home,
  "/solicitudes": Receipt,
  "/anticipos": HandCoins,
  "/tesoreria": Landmark,
  "/direccion": BadgeCheck,
  "/legalizacion": FileCheck2,
  "/contabilidad": Calculator,
  "/tablero": BarChart3,
  "/reportes": FileSpreadsheet,
  "/admin": Settings2,
  "/usuarios": Users
}

// Módulos agrupados en menús desplegables para que el menú quepa en una fila.
// Un grupo con un solo módulo permitido se muestra como enlace directo. Lo que no esté en un
// grupo (Tesorería, Aprobación de pagos, Legalización, Contabilidad, Tablero de Control y Usuarios) va como enlace.
const GRUPOS: { nombre: string, Icono: LucideIcon, modulos: string[] }[] = [
  { nombre: "Solicitudes", Icono: Receipt, modulos: ["/solicitudes", "/anticipos"] },
  { nombre: "Informes", Icono: BarChart3, modulos: ["/tablero", "/reportes"] }
]

const claseEnlace = (activo: boolean) => clsx(
  "flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium whitespace-nowrap transition",
  activo ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
)

type Enlace = Pick<Modulo, "href" | "nombre"> & { descripcion?: string }

export default function Navegacion({ modulos }: { modulos: Modulo[] }) {
  const pathname = usePathname()
  const estaEn = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const enlace = ({ href, nombre }: Enlace) => {
    const Icono = ICONOS[href]
    return (
      <Link key={href} href={href} aria-current={estaEn(href) ? "page" : undefined} className={claseEnlace(estaEn(href))}>
        {Icono && <Icono size={15} />}
        {nombre}
      </Link>
    )
  }

  // Orden: Inicio, luego cada grupo (o módulo suelto) en el orden de MODULOS
  const elementos: React.ReactNode[] = [enlace({ href: "/inicio", nombre: "Inicio" })]
  const usados = new Set<string>()

  for (const modulo of modulos) {
    if (usados.has(modulo.href)) continue
    const grupo = GRUPOS.find(g => g.modulos.includes(modulo.href))
    const delGrupo = grupo ? modulos.filter(m => grupo.modulos.includes(m.href)) : [modulo]
    delGrupo.forEach(m => usados.add(m.href))

    if (!grupo || delGrupo.length === 1) {
      elementos.push(enlace(delGrupo[0]))
      continue
    }

    const activo = delGrupo.some(m => estaEn(m.href))
    elementos.push(
      <Menu key={grupo.nombre}>
        <MenuButton className={clsx(claseEnlace(activo), "data-[open]:bg-slate-100 data-[open]:text-slate-700")}>
          <grupo.Icono size={15} />
          {grupo.nombre}
          <ChevronDown size={13} className="opacity-60" />
        </MenuButton>
        <MenuItems
          anchor="bottom start"
          className="z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl focus:outline-none"
        >
          {delGrupo.map(m => {
            const Icono = ICONOS[m.href]
            return (
              <MenuItem key={m.href}>
                <Link
                  href={m.href}
                  className={clsx(
                    "flex items-start gap-3 rounded-lg px-3 py-2.5 data-[focus]:bg-slate-50",
                    estaEn(m.href) && "bg-emerald-50/70"
                  )}
                >
                  {Icono && <Icono size={16} className={clsx("mt-0.5 shrink-0", estaEn(m.href) ? "text-emerald-600" : "text-slate-400")} />}
                  <span>
                    <span className={clsx("block text-xs font-semibold", estaEn(m.href) ? "text-emerald-700" : "text-slate-700")}>{m.nombre}</span>
                    <span className="block text-[11px] leading-snug text-slate-400">{m.descripcion}</span>
                  </span>
                </Link>
              </MenuItem>
            )
          })}
        </MenuItems>
      </Menu>
    )
  }

  return <nav className="flex flex-wrap gap-1">{elementos}</nav>
}
