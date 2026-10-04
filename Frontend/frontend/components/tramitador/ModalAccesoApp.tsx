"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Copy, KeyRound, Loader2, ShieldOff, X } from "lucide-react"
import { crearAccesoApp, quitarAccesoApp, type AccesoCreado } from "@/actions/tramitadores-action"

export type EstadoAccesoApp = {
  debeCambiarContrasena: boolean
  ultimoIngreso: string | null
  bloqueadoHasta: string | null
} | null

const formatoFechaHora = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" })

// Estado del acceso en una etiqueta corta para la tabla
export function EtiquetaAccesoApp({ acceso }: { acceso: EstadoAccesoApp }) {
  const [clase, texto] =
    !acceso ? ["border-slate-200 bg-slate-50 text-slate-400", "Sin acceso"]
      : acceso.bloqueadoHasta && new Date(acceso.bloqueadoHasta) > new Date() ? ["border-red-200 bg-red-50 text-red-700", "Bloqueado"]
        : acceso.debeCambiarContrasena ? ["border-amber-200 bg-amber-50 text-amber-700", "Contraseña temporal"]
          : ["border-sky-200 bg-sky-50 text-sky-700", "Con acceso"]

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${clase}`}>{texto}</span>
  )
}

// Crear acceso, restablecer contraseña o quitar el acceso a la app Nodex Tramitadores
export default function ModalAccesoApp({
  tramitador,
  onCerrar
}: {
  tramitador: { id: number, nombreTramitador: string, activo: boolean, acceso?: EstadoAccesoApp }
  onCerrar: () => void
}) {
  const acceso = tramitador.acceso ?? null
  const [creado, setCreado] = useState<AccesoCreado | null>(null)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)
  const [trabajando, startTrabajo] = useTransition()

  const generar = () =>
    startTrabajo(async () => {
      const resultado = await crearAccesoApp(tramitador.id)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      setCreado(resultado.datos)
    })

  const quitar = () =>
    startTrabajo(async () => {
      const resultado = await quitarAccesoApp(tramitador.id)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success(`Se quitó el acceso a la app de ${tramitador.nombreTramitador}`)
      onCerrar()
    })

  const mensaje = creado && [
    `Hola ${tramitador.nombreTramitador}, estos son tus datos para ingresar a Nodex Tramitadores:`,
    process.env.NEXT_PUBLIC_URL_APP_TRAMITADORES ? `Enlace: ${process.env.NEXT_PUBLIC_URL_APP_TRAMITADORES}` : null,
    `Usuario: ${creado.usuario}`,
    `Contraseña temporal: ${creado.contrasenaTemporal}`,
    "Al ingresar por primera vez debes cambiar la contraseña."
  ].filter(Boolean).join("\n")

  const copiar = async (texto: string, aviso: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success(aviso)
    } catch {
      toast.error("No se pudo copiar; selecciónelo y cópielo a mano")
    }
  }

  return (
    <Dialog open onClose={() => !trabajando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <DialogTitle className="text-sm font-semibold text-slate-800">Acceso a la app · {tramitador.nombreTramitador}</DialogTitle>
              <p className="mt-1"><EtiquetaAccesoApp acceso={acceso} /></p>
            </div>
            <button type="button" onClick={onCerrar} disabled={trabajando} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="px-6 py-5 space-y-4 text-xs text-slate-600">
            {creado ? (
              <>
                <p>
                  {creado.restablecido ? "Contraseña restablecida. Las sesiones abiertas se cerraron." : "Acceso creado."}{" "}
                  Entréguele estos datos al tramitador. <b>La contraseña no se vuelve a mostrar.</b>
                </p>
                <div className="space-y-2 rounded-md bg-slate-50 px-4 py-3">
                  <p className="flex justify-between gap-3"><span className="text-slate-500">Usuario</span><b className="font-mono text-slate-800">{creado.usuario}</b></p>
                  <p className="flex justify-between gap-3"><span className="text-slate-500">Contraseña temporal</span><b className="font-mono text-slate-800 select-all">{creado.contrasenaTemporal}</b></p>
                </div>
                <button type="button" onClick={() => copiar(mensaje!, "Mensaje copiado: péguelo en WhatsApp")} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600">
                  <Copy size={14} />
                  Copiar mensaje para WhatsApp
                </button>
              </>
            ) : (
              <>
                {!tramitador.activo && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">El tramitador está inactivo: no puede ingresar a la app. Actívelo primero.</p>
                )}
                {acceso ? (
                  <p>
                    {acceso.ultimoIngreso ? <>Último ingreso: <b>{formatoFechaHora(acceso.ultimoIngreso)}</b>.</> : "Aún no ha ingresado."}{" "}
                    Si olvidó la contraseña, restablézcala: se genera una temporal nueva y se cierran sus sesiones.
                  </p>
                ) : (
                  <p>Se genera una contraseña temporal. Su usuario será su identificación y en el primer ingreso deberá cambiar la contraseña.</p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={generar} disabled={trabajando || !tramitador.activo} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-50">
                    {trabajando ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    {acceso ? "Restablecer contraseña" : "Crear acceso"}
                  </button>

                  {acceso && (confirmarQuitar ? (
                    <button type="button" onClick={quitar} disabled={trabajando} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                      <ShieldOff size={15} />
                      Confirmar: quitar acceso
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirmarQuitar(true)} disabled={trabajando} className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      <ShieldOff size={15} />
                      Quitar acceso
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
