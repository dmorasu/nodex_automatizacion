"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Upload } from "lucide-react"
import { subirSoporte } from "@/actions/gastos"
import { formatoMoneda } from "@/src/lib/formato"
import { TIPOS_SOPORTE, type TipoSoporte } from "@/src/tiposDocumento"
import HojaInferior from "../ui/HojaInferior"
import SelectorArchivos from "../ui/SelectorArchivos"
import SelectorTipo from "../ui/SelectorTipo"
import { claseBotonPrimario, claseBotonSecundario, claseSelect, claseTextarea } from "../ui/estilos"

type ReintegroPendiente = { id: number, valor: string }

// Sube un documento del gasto: Reintegro (comprobante de lo que devuelve), Factura u Otro.
// Antes se elige el tipo; el nombre del archivo queda con ese prefijo. Lo revisa Legalización.
export default function SubirSoporte({
  gastoId,
  puedeSubirFactura,
  reintegros,
  tipoInicial = null,
  texto = "Subir documento",
  principal = false
}: {
  gastoId: number
  puedeSubirFactura: boolean
  reintegros: ReintegroPendiente[]
  tipoInicial?: TipoSoporte | null
  texto?: string
  principal?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoSoporte | null>(tipoInicial)
  const [reintegroId, setReintegroId] = useState<number | null>(reintegros[0]?.id ?? null)
  const [archivos, setArchivos] = useState<File[]>([])
  const [observacion, setObservacion] = useState("")
  const [enviando, startEnviar] = useTransition()

  // Solo se ofrece lo que aplica al gasto hoy
  const opciones = TIPOS_SOPORTE.map(t => ({
    ...t,
    deshabilitada:
      t.codigo === "FACTURA" && !puedeSubirFactura ? "ya está registrada o en revisión"
        : t.codigo === "REINTEGRO" && reintegros.length === 0 ? "no tiene reintegros pendientes"
          : null
  }))

  const reintegro = reintegros.find(r => r.id === reintegroId)

  const reiniciar = () => {
    setTipo(tipoInicial)
    setReintegroId(reintegros[0]?.id ?? null)
    setArchivos([])
    setObservacion("")
  }

  const cerrar = () => {
    if (enviando) return
    setAbierto(false)
    reiniciar()
  }

  const enviar = () => {
    if (!tipo) return toast.error("Seleccione qué tipo de documento es")
    if (tipo === "REINTEGRO" && !reintegroId) return toast.error("Seleccione el reintegro")
    if (archivos.length === 0) return toast.error("Tome una foto o elija un archivo")

    const datos = new FormData()
    datos.append("tipo", tipo)
    if (tipo === "REINTEGRO") datos.append("reintegroId", String(reintegroId))
    if (observacion.trim()) datos.append("observacion", observacion.trim())
    archivos.forEach(archivo => datos.append("archivos", archivo))

    startEnviar(async () => {
      const resultado = await subirSoporte(gastoId, datos)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Enviado. Legalización lo revisará")
      setAbierto(false)
      reiniciar()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={`${principal ? claseBotonPrimario : claseBotonSecundario} w-full`}>
        <Upload size={17} />
        {texto}
      </button>

      <HojaInferior
        abierta={abierto}
        onCerrar={cerrar}
        titulo="Subir documento del gasto"
        descripcion="Legalización lo revisará y le avisará si hay algún problema."
        pie={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={cerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={enviar} disabled={enviando || !tipo || archivos.length === 0} className={claseBotonPrimario}>
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        }
      >
        <SelectorTipo opciones={opciones} valor={tipo} onCambio={codigo => setTipo(codigo as TipoSoporte)} deshabilitado={enviando} />

        {/* Si debe varios reintegros, elige cuál paga con este comprobante */}
        {tipo === "REINTEGRO" && reintegros.length > 1 && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">¿Cuál reintegro?</span>
            <select
              value={reintegroId ?? ""}
              onChange={e => setReintegroId(Number(e.target.value))}
              className={claseSelect}
            >
              {reintegros.map(r => <option key={r.id} value={r.id}>{formatoMoneda(r.valor)}</option>)}
            </select>
          </label>
        )}
        {tipo === "REINTEGRO" && reintegro && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Adjunte la boleta o comprobante de la consignación por <b>{formatoMoneda(reintegro.valor)}</b>.
          </p>
        )}
        {tipo === "FACTURA" && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Foto clara de la factura completa (una foto por página) o el PDF.
          </p>
        )}

        <p className="mt-5 mb-2 text-xs font-semibold text-slate-600">2. Tome la foto o elija el archivo</p>
        <SelectorArchivos archivos={archivos} onCambio={setArchivos} deshabilitado={enviando} />

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Observación (opcional)</span>
          <textarea
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ej: número de factura o banco donde consignó"
            className={claseTextarea}
          />
        </label>
      </HojaInferior>
    </>
  )
}
