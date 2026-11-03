"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CircleDollarSign, Loader2 } from "lucide-react"
import { marcarSinFondos } from "@/actions/gastos/tesoreria"
import type { GastoListado } from "@/src/schemas/gastos"
import { claseBotonPrimario, claseBotonSecundario, claseTextarea } from "../ui/estilos"

// Bolsa sin fondos, pendiente de anticipo: deja la nota en el historial de los seleccionados
// sin programarlos (siguen en Solicitado)
export default function BotonSinFondos({ gastos, onMarcados }: { gastos: GastoListado[], onMarcados: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [observacion, setObservacion] = useState("")
  const [procesando, startProcesar] = useTransition()

  const confirmar = () => {
    startProcesar(async () => {
      const resultado = await marcarSinFondos(gastos.map(g => g.id), observacion.trim())
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(resultado.datos.marcados === 1 ? "Gasto marcado sin fondos" : `${resultado.datos.marcados} gastos marcados sin fondos`)
      setObservacion("")
      setAbierto(false)
      onMarcados()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} disabled={gastos.length === 0} className={claseBotonSecundario}>
        <CircleDollarSign size={15} />
        Sin fondos
      </button>

      <Dialog open={abierto} onClose={() => !procesando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Sin fondos, pendiente de anticipo</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">{gastos.map(g => g.codigo).join(", ")}</p>

            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Observación (opcional)"
              className={`${claseTextarea} mt-4`}
              autoFocus
            />

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={procesando} className={claseBotonSecundario}>
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
