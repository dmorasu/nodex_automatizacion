"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Home, Menu, X } from "lucide-react"
import type { Modulo } from "@/src/auth/permisos"
import { ICONOS } from "./Navegacion"

// Menú del celular: un botón abre un panel lateral con todos los módulos del usuario
// (en pantallas grandes se usa la barra de Navegacion)
export default function MenuMovil({ modulos }: { modulos: Modulo[] }) {
  const [abierto, setAbierto] = useState(false)
  const pathname = usePathname()
  const estaEn = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const enlaces = [{ href: "/inicio", nombre: "Inicio" }, ...modulos]

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <Dialog open={abierto} onClose={setAbierto} className="relative z-50 md:hidden">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
        <div className="fixed inset-y-0 right-0 flex w-full max-w-xs">
          <DialogPanel className="flex w-full flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <DialogTitle className="text-sm font-semibold text-slate-800">Nodex Gastos</DialogTitle>
              <button type="button" onClick={() => setAbierto(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600" aria-label="Cerrar menú">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {enlaces.map(({ href, nombre }) => {
                  const Icono = ICONOS[href] ?? Home
                  const activo = estaEn(href)
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setAbierto(false)}
                        aria-current={activo ? "page" : undefined}
                        className={clsx(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                          activo ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Icono size={18} className={activo ? "text-emerald-600" : "text-slate-400"} />
                        {nombre}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
