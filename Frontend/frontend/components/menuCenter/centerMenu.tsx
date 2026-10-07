"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react"
import {
  BellRing,
  CircleCheckBig,
  FilePlus2,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Receipt,
  Route,
  Settings2,
  ShieldCheck,
  Tags,
  Upload,
  FileUp,
  UserCog,
  UserRoundPlus,
  Users,
  type LucideIcon
} from "lucide-react"

import { Usuario } from "@/src/schemas"
import { NOMBRES_PERFIL, type PerfilTramites } from "@/src/auth/perfiles"
import { cerrarSesion } from "@/actions/cerrarSesion"

type Opcion = { href: string, nombre: string, icono: LucideIcon, visible: boolean }
type Seccion = { titulo: string, opciones: Opcion[] }

// "Diego Alejandro Mora" → "DA"
const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?"

// Menú principal de Nodex Trámites, agrupado por secciones. Cada opción se muestra según
// el perfil y los permisos (las páginas y el backend vuelven a revisarlos).
export default function CenterMenu({
  usuario,
  perfil,
  esAdmin,
  puedeAsignarAnalistas,
  puedeConfigurarNotificaciones,
}: {
  usuario: Usuario
  perfil: PerfilTramites
  esAdmin: boolean
  puedeAsignarAnalistas: boolean
  puedeConfigurarNotificaciones: boolean
}) {
  const ruta = usePathname()

  // Gestión de activos no ve el tablero, los reportados como realizados, las rutas, la gestión masiva ni los catálogos
  const esTorreControl = perfil === "TORRE_CONTROL"

  const secciones: Seccion[] = [
    {
      titulo: "Seguimiento",
      opciones: [
        { href: "/center/dashboard", nombre: "Dashboard", icono: LayoutDashboard, visible: true },
        { href: "/center/torreControl", nombre: "Tablero de gestión", icono: Radar, visible: esTorreControl },
        { href: "/center/reportesRealizado", nombre: "Reportados como realizados", icono: CircleCheckBig, visible: esTorreControl },
        { href: "/center/rutas", nombre: "Rutas de mensajeros", icono: Route, visible: esTorreControl }
      ]
    },
    {
      titulo: "Crear y cargar",
      opciones: [
        { href: "/center/solicitudTramites/nueva", nombre: "Nuevo trámite", icono: FilePlus2, visible: true },
        { href: "/center/clientes/nuevo", nombre: "Nuevo cliente", icono: UserRoundPlus, visible: true },
        { href: "/center/cargueMasiva", nombre: "Cargue masivo de trámites", icono: Upload, visible: true },
        { href: "/center/cargueDocumentos", nombre: "Cargue masivo de documentos", icono: FileUp, visible: true },
        { href: "/center/cargueMasivoClientes", nombre: "Cargue masivo de clientes", icono: FileSpreadsheet, visible: true },
        { href: "/center/cargueMasivoGastos", nombre: "Cargue masivo de gastos", icono: Receipt, visible: perfil === "GESTION_ACTIVOS" || esAdmin },
        { href: "/center/gestionMasiva", nombre: "Gestión masiva", icono: Settings2, visible: esTorreControl }
      ]
    },
    {
      titulo: "Configuración",
      opciones: [
        { href: "/center/catalogos", nombre: "Catálogos y tramitadores", icono: Tags, visible: esTorreControl },
        { href: "/center/analistas", nombre: "Asignación de analistas", icono: UserCog, visible: puedeAsignarAnalistas },
        { href: "/center/notificaciones", nombre: "Notificaciones automáticas", icono: BellRing, visible: puedeConfigurarNotificaciones },
        // Admin o Administrador de Torre de control (los mismos que asignan analistas)
        { href: "/center/admin", nombre: "Administración", icono: ShieldCheck, visible: esAdmin || puedeAsignarAnalistas }
      ]
    }
  ]

  // La opción activa es la de la ruta más larga que coincide (ej: /center/dashboard)
  const activa = secciones
    .flatMap(s => s.opciones)
    .filter(o => o.visible && (ruta === o.href || ruta.startsWith(`${o.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <PopoverButton
            className="group flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 data-[open]:border-sky-300 data-[open]:text-sky-600"
            aria-label="Abrir menú"
          >
            <Menu size={21} strokeWidth={1.8} />
          </PopoverButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1 scale-95"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 translate-y-1 scale-95"
          >
            <PopoverPanel className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] origin-top-right">
              <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">

                {/* USUARIO */}
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                    {iniciales(usuario.nombreUsuario)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{usuario.nombreUsuario}</p>
                    <p className="truncate text-[11px] text-slate-500">{usuario.correoUsuario}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-px text-[10px] font-semibold text-sky-700">
                      <Users size={10} /> {NOMBRES_PERFIL[perfil]}
                    </span>
                  </div>
                </div>

                {/* NAVEGACIÓN */}
                <nav className="flex-1 overflow-y-auto p-2" aria-label="Menú principal">
                  {secciones.map(seccion => {
                    const opciones = seccion.opciones.filter(o => o.visible)
                    if (opciones.length === 0) return null
                    return (
                      <div key={seccion.titulo} className="mb-1 last:mb-0">
                        <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {seccion.titulo}
                        </p>
                        {opciones.map(({ href, nombre, icono: Icono }) => {
                          const esActiva = activa === href
                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => close()}
                              aria-current={esActiva ? "page" : undefined}
                              className={clsx(
                                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                                esActiva ? "bg-sky-50 font-semibold text-sky-700" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )}
                            >
                              <Icono size={17} className={clsx("shrink-0", esActiva ? "text-sky-600" : "text-slate-400 group-hover:text-sky-500")} />
                              <span className="flex-1 truncate">{nombre}</span>
                              {esActiva && <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />}
                            </Link>
                          )
                        })}
                      </div>
                    )
                  })}
                </nav>

                {/* CERRAR SESIÓN */}
                <div className="border-t border-slate-200 p-2">
                  <button
                    type="button"
                    onClick={async () => {
                      close()
                      await cerrarSesion()
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut size={17} className="text-slate-400 group-hover:text-red-500" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  )
}
