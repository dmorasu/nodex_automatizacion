"use client"

import Link from "next/link"
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import { CircleUserRound, KeyRound, LogOut } from "lucide-react"
import { cerrarSesion } from "@/actions/sesion"
import { quitarSuscripcionPush } from "@/actions/notificaciones"
import { suscripcionActual } from "@/src/lib/push"

// Al salir, este celular deja de recibir los avisos del tramitador (puede ser un celular prestado).
// Si algo falla, igual cierra la sesión.
const salir = async () => {
  try {
    const suscripcion = await suscripcionActual()
    if (suscripcion) {
      await quitarSuscripcionPush(suscripcion.endpoint)
      await suscripcion.unsubscribe()
    }
  } catch {
    // Sin conexión o navegador sin push: no impide cerrar la sesión
  }
  await cerrarSesion()
}

export default function MenuCuenta({ nombre, identificacion }: { nombre: string, identificacion: string }) {
  return (
    <Menu as="div" className="relative">
      <MenuButton className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 active:bg-slate-100" aria-label="Mi cuenta">
        <CircleUserRound size={24} />
      </MenuButton>

      <MenuItems anchor="bottom end" className="z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl focus:outline-none">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-slate-800">{nombre}</p>
          <p className="text-xs text-slate-400">C.C. {identificacion}</p>
        </div>
        <div className="my-1 border-t border-slate-100" />
        <MenuItem>
          <Link href="/cambiar-contrasena" className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-600 data-[focus]:bg-slate-50">
            <KeyRound size={17} className="text-slate-400" />
            Cambiar contraseña
          </Link>
        </MenuItem>
        <MenuItem>
          <button type="button" onClick={() => salir()} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-red-600 data-[focus]:bg-red-50">
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  )
}
