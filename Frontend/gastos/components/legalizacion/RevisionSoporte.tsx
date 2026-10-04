"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Check, Loader2, X } from "lucide-react"
import { aprobarSoporte, rechazarSoporte } from "@/actions/gastos/legalizacion"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseTextarea } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Aprobar o rechazar un soporte subido por el tramitador
export default function RevisionSoporte({
  soporteId,
  esReintegro,
  esFactura = false,
  valorReintegro
}: {
  soporteId: number
  esReintegro: boolean
  esFactura?: boolean
  valorReintegro: string | null
}) {
  const [modo, setModo] = useState<"aprobar" | "rechazar" | null>(null)
  const [fecha, setFecha] = useState(hoyEnBogota)
  const [motivo, setMotivo] = useState("")
  const [guardando, startGuardar] = useTransition()

  const confirmar = () =>
    startGuardar(async () => {
      if (modo === "rechazar" && !motivo.trim()) {
        toast.error("Indique el motivo del rechazo")
        return
      }

      const resultado = modo === "aprobar"
        ? await aprobarSoporte(soporteId, esReintegro ? fecha : null)
        : await rechazarSoporte(soporteId, motivo)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(resultado.datos)
      setModo(null)
    })

  if (!modo) {
    return (
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setModo("rechazar")} className={`${claseBotonSecundario} h-8 px-3`}>
          <X size={14} />
          Rechazar
        </button>
        <button type="button" onClick={() => setModo("aprobar")} className={`${claseBotonPrimario} h-8 px-3`}>
          <Check size={14} />
          Aprobar
        </button>
      </div>
    )
  }

  return (
    <div className="ml-auto w-72 space-y-2 text-left">
      {modo === "aprobar" ? (
        esReintegro ? (
          <label className="block text-[11px] text-slate-600">
            El reintegro de <b>{formatoMoneda(valorReintegro)}</b> quedará recibido y volverá a la bolsa. Fecha en que se recibió:
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={`${claseInput} mt-1 h-8`} />
          </label>
        ) : (
          <p className="text-[11px] text-slate-600">
            {esFactura
              ? <>El archivo pasa a los documentos del gasto. Después registre los valores de la factura en &quot;Gastos sin factura&quot;.</>
              : "El archivo pasa a los documentos del gasto."}
          </p>
        )
      ) : (
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Motivo del rechazo (lo verá el tramitador)"
          className={claseTextarea}
          autoFocus
        />
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setModo(null)} disabled={guardando} className={`${claseBotonSecundario} h-8 px-3`}>Cancelar</button>
        <button type="button" onClick={confirmar} disabled={guardando} className={`${claseBotonPrimario} h-8 px-3`}>
          {guardando && <Loader2 size={14} className="animate-spin" />}
          {modo === "aprobar" ? "Confirmar aprobación" : "Confirmar rechazo"}
        </button>
      </div>
    </div>
  )
}
