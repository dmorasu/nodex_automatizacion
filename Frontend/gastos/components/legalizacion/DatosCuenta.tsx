"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Pencil } from "lucide-react"
import { actualizarCuenta } from "@/actions/gastos/legalizacion"
import { formatoFecha } from "@/src/lib/formato"
import type { CuentaDetalle } from "@/src/schemas/gastos"
import Dato from "../ui/Dato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"

// Datos generales de la cuenta de cobro; editables solo en borrador
export default function DatosCuenta({ cuenta }: { cuenta: CuentaDetalle }) {
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState({
    numeroCuentaCobro: cuenta.numeroCuentaCobro,
    fechaRadicacion: cuenta.fechaRadicacion ?? "",
    observacion: cuenta.observacion ?? ""
  })
  const [guardando, startGuardar] = useTransition()

  const cambiar = (campo: keyof typeof datos, valor: string) => setDatos(actuales => ({ ...actuales, [campo]: valor }))

  const guardar = () => {
    if (!datos.numeroCuentaCobro.trim()) return toast.error("El número es obligatorio")

    startGuardar(async () => {
      const resultado = await actualizarCuenta(cuenta.id, datos)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success("Cuenta de cobro actualizada")
      setEditando(false)
    })
  }

  if (!editando) {
    return (
      <div className="flex items-start justify-between gap-4">
        <dl className="grid flex-1 gap-5 sm:grid-cols-3">
          <Dato etiqueta="Número" valor={cuenta.numeroCuentaCobro} />
          <Dato etiqueta="Fecha de radicación" valor={formatoFecha(cuenta.fechaRadicacion)} />
          <Dato etiqueta="Observación" valor={cuenta.observacion} />
        </dl>
        {cuenta.permisos.editar && (
          <button type="button" onClick={() => setEditando(true)} className="p-2 text-slate-400 hover:text-emerald-600" aria-label="Editar datos">
            <Pencil size={15} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={claseLabel}>Número <span className="text-red-400">*</span></span>
          <input value={datos.numeroCuentaCobro} onChange={e => cambiar("numeroCuentaCobro", e.target.value)} maxLength={50} className={claseInput} />
        </label>
        <label className="block">
          <span className={claseLabel}>Fecha de radicación</span>
          <input type="date" value={datos.fechaRadicacion} onChange={e => cambiar("fechaRadicacion", e.target.value)} className={claseInput} />
        </label>
        <label className="block sm:col-span-2">
          <span className={claseLabel}>Observación</span>
          <textarea value={datos.observacion} onChange={e => cambiar("observacion", e.target.value)} rows={2} maxLength={2000} className={claseTextarea} />
        </label>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => setEditando(false)} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={guardando} className={claseBotonPrimario}>
          {guardando && <Loader2 size={15} className="animate-spin" />}
          Guardar
        </button>
      </div>
    </div>
  )
}
