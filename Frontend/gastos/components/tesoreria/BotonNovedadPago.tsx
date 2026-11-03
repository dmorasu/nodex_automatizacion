"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CircleAlert, Loader2 } from "lucide-react"
import { registrarNovedadPago, type MotivoNovedadPago } from "@/actions/gastos/tesoreria"
import type { GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseTextarea } from "../ui/estilos"

const MOTIVOS: { valor: MotivoNovedadPago, nombre: string }[] = [
  { valor: "SIN_FONDOS", nombre: "Bolsa sin fondos, pendiente de anticipo" },
  { valor: "SIN_TRAMITADOR", nombre: "El trámite no tiene tramitador" },
  { valor: "OTRO", nombre: "Otro motivo" }
]

// Novedad de pago: por qué no se programa el pago de los seleccionados. Deja la nota en su
// historial y siguen en Solicitado
export default function BotonNovedadPago({ gastos, onMarcados }: { gastos: GastoListado[], onMarcados: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState<MotivoNovedadPago | "">("")
  const [observacion, setObservacion] = useState("")
  const [procesando, startProcesar] = useTransition()

  const cerrar = () => {
    setAbierto(false)
    setMotivo("")
    setObservacion("")
  }

  const confirmar = () => {
    if (!motivo) return toast.error("Elija el motivo")
    if (motivo === "OTRO" && !observacion.trim()) return toast.error("Cuente cuál es el motivo")

    startProcesar(async () => {
      const resultado = await registrarNovedadPago(gastos.map(g => g.id), motivo, observacion.trim())
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(resultado.datos.marcados === 1 ? "Novedad registrada en el historial" : `Novedad registrada en ${resultado.datos.marcados} gastos`)
      cerrar()
      onMarcados()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} disabled={gastos.length === 0} className={claseBotonSecundario}>
        <CircleAlert size={15} />
        Novedad de pago
      </button>

      <Dialog open={abierto} onClose={() => !procesando && cerrar()} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Novedad de pago</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">{gastos.map(g => g.codigo).join(", ")}</p>

            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value as MotivoNovedadPago | "")}
              className={`${claseInput} mt-4`}
              aria-label="Motivo"
              autoFocus
            >
              <option value="">Motivo</option>
              {MOTIVOS.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
            </select>

            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={motivo === "OTRO" ? "Observación" : "Observación (opcional)"}
              className={`${claseTextarea} mt-3`}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={cerrar} disabled={procesando} className={claseBotonSecundario}>
                Cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={procesando} className={claseBotonPrimario}>
                {procesando && <Loader2 size={15} className="animate-spin" />}
                Registrar
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
