"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"

// Ventana que en el celular sube desde abajo (y en pantallas grandes queda centrada).
// Nunca es más ancha que la pantalla: el contenido largo se desplaza hacia abajo.
export default function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  pie,
  children
}: {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: React.ReactNode
  pie?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Dialog open={abierta} onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
          <div className="overflow-y-auto overflow-x-hidden px-5 pt-5">
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
            <DialogTitle className="text-base font-semibold text-slate-800">{titulo}</DialogTitle>
            {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
            <div className="mt-4 pb-4">{children}</div>
          </div>
          {pie && (
            <div className="border-t border-slate-100 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{pie}</div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
