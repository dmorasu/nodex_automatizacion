"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Ban, Loader2 } from "lucide-react"
import { claseBotonPeligro, claseBotonSecundario, claseTextarea } from "./estilos"

type Resultado = { ok: true } | { ok: false, errores: string[] }

// Botón que abre una ventana para confirmar una acción irreversible con su motivo (ej: anular)
export default function BotonConMotivo({
  etiqueta,
  titulo,
  descripcion,
  mensajeExito,
  onConfirmar
}: {
  etiqueta: string
  titulo: string
  descripcion: string
  mensajeExito: string
  onConfirmar: (motivo: string) => Promise<Resultado>
}) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [procesando, startProcesar] = useTransition()

  const confirmar = () => {
    if (!motivo.trim()) return toast.error("Indique el motivo")

    startProcesar(async () => {
      const resultado = await onConfirmar(motivo.trim())

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(mensajeExito)
      setAbierto(false)
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={claseBotonPeligro}>
        <Ban size={15} />
        {etiqueta}
      </button>

      <Dialog open={abierto} onClose={() => !procesando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">{titulo}</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">{descripcion}</p>

            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Motivo"
              className={`${claseTextarea} mt-4`}
              autoFocus
            />

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={procesando} className={claseBotonSecundario}>
                Cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={procesando} className={claseBotonPeligro}>
                {procesando && <Loader2 size={15} className="animate-spin" />}
                {etiqueta}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
