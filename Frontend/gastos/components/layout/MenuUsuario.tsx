"use client"

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { BookOpen, CircleUser, LogOut } from "lucide-react"
import { cerrarSesion } from "@/actions/cerrarSesion"
import { NOMBRES_ROL } from "@/src/auth/permisos"
import type { Sesion } from "@/src/schemas"

export default function MenuUsuario({ sesion }: { sesion: Sesion }) {
  return (
    <Popover className="relative">

      <PopoverButton className="
        flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white
        text-xs text-slate-600 shadow-sm transition
        hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-100
      ">
        <CircleUser size={18} className="text-emerald-600" />
        <span className="hidden sm:inline max-w-[160px] truncate">{sesion.nombreUsuario}</span>
      </PopoverButton>

      <PopoverPanel
        anchor="bottom end"
        className="z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="px-4 py-4 border-b border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 truncate">{sesion.nombreUsuario}</p>
          <p className="text-xs text-slate-400 truncate">{sesion.correoUsuario}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {sesion.roles.length > 0
              ? sesion.roles.map(rol => (
                <span
                  key={rol}
                  className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-semibold text-emerald-700"
                >
                  {NOMBRES_ROL[rol] ?? rol}
                </span>
              ))
              : <span className="text-[10px] text-slate-400">Sin roles asignados</span>}
          </div>
        </div>

        <div className="p-2 pb-0">
          <a
            href="/manual"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <BookOpen size={15} className="text-emerald-600" />
            Manual Nodex
          </a>
        </div>

        <form action={cerrarSesion} className="p-2">
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </form>
      </PopoverPanel>

    </Popover>
  )
}
