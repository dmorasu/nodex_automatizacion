"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { FilePlus2, Loader2, Upload } from "lucide-react"
import { subirDocumentosTramite } from "@/actions/tramites"
import { formatoMoneda } from "@/src/lib/formato"
import type { GastoDelTramite } from "@/src/schemas"
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/src/tiposDocumento"
import HojaInferior from "../ui/HojaInferior"
import SelectorArchivos from "../ui/SelectorArchivos"
import SelectorTipo from "../ui/SelectorTipo"
import { claseBotonPrimario, claseBotonSecundario, claseSelect } from "../ui/estilos"

// Gastos del trámite que necesitan este tipo de documento
const gastosQueLoNecesitan = (gastos: GastoDelTramite[], tipo: TipoDocumento | null) =>
  tipo === "FACTURA" ? gastos.filter(g => g.puedeSubirFactura)
    : tipo === "BOLETA_REINTEGRO" ? gastos.filter(g => g.reintegrosPorSoportar.length > 0)
      : []

// Documentos del trámite. Antes de subirlos se elige qué son; el nombre queda con ese prefijo.
// Una Factura o una Boleta de reintegro llega sola al gasto del trámite que la necesita
// (Legalización la revisa): se sube una sola vez y se ve en el trámite y en el gasto.
export default function SubirDocumentos({
  tramiteId,
  gastos,
  tipoInicial = null,
  gastoInicialId = null,
  texto = "Subir documentos",
  principal = false
}: {
  tramiteId: number
  gastos: GastoDelTramite[]
  tipoInicial?: TipoDocumento | null
  gastoInicialId?: number | null
  texto?: string
  principal?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoDocumento | null>(tipoInicial)
  const [gastoId, setGastoId] = useState<number | null>(gastoInicialId)
  const [archivos, setArchivos] = useState<File[]>([])
  const [enviando, startEnviar] = useTransition()

  const candidatos = gastosQueLoNecesitan(gastos, tipo)
  // Con un solo gasto que lo necesita, va a ese; con varios, se elige
  const destino = candidatos.length === 1 ? candidatos[0] : candidatos.find(g => g.id === gastoId) ?? null
  const faltaElegirGasto = candidatos.length > 1 && !destino

  const reiniciar = () => {
    setTipo(tipoInicial)
    setGastoId(gastoInicialId)
    setArchivos([])
  }

  const cerrar = () => {
    if (enviando) return
    setAbierto(false)
    reiniciar()
  }

  const enviar = () => {
    if (!tipo) return toast.error("Seleccione qué tipo de documento es")
    if (faltaElegirGasto) return toast.error("Seleccione a qué gasto corresponde")
    if (archivos.length === 0) return toast.error("Tome una foto o elija un archivo")

    const datos = new FormData()
    datos.append("tipoDocumento", tipo)
    if (destino) datos.append("solicitudGastoId", String(destino.id))
    archivos.forEach(archivo => datos.append("archivos", archivo))

    startEnviar(async () => {
      const resultado = await subirDocumentosTramite(tramiteId, datos)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success(resultado.mensaje)
      setAbierto(false)
      reiniciar()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={`${principal ? claseBotonPrimario : claseBotonSecundario} w-full`}>
        {principal ? <Upload size={17} /> : <FilePlus2 size={17} />}
        {texto}
      </button>

      <HojaInferior
        abierta={abierto}
        onCerrar={cerrar}
        titulo="Documentos del trámite"
        descripcion="El equipo los verá de inmediato en el trámite."
        pie={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={cerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={enviar} disabled={enviando || !tipo || faltaElegirGasto || archivos.length === 0} className={claseBotonPrimario}>
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {enviando ? "Subiendo..." : "Subir"}
            </button>
          </div>
        }
      >
        <SelectorTipo opciones={TIPOS_DOCUMENTO} valor={tipo} onCambio={codigo => setTipo(codigo as TipoDocumento)} deshabilitado={enviando} />

        {/* A qué gasto llega (Factura o Boleta de reintegro) */}
        {(tipo === "FACTURA" || tipo === "BOLETA_REINTEGRO") && (
          candidatos.length > 1 ? (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">¿A qué gasto corresponde? <span className="text-red-400">*</span></span>
              <select value={gastoId ?? ""} onChange={e => setGastoId(Number(e.target.value) || null)} className={claseSelect}>
                <option value="">Seleccione el gasto</option>
                {candidatos.map(g => (
                  <option key={g.id} value={g.id}>{g.codigo} · {g.conceptoPago} · {formatoMoneda(g.valorRealmentePagado)}</option>
                ))}
              </select>
            </label>
          ) : destino ? (
            <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              También se envía a Legalización con el gasto <b>{destino.codigo}</b> ({destino.conceptoPago}). No tiene que subirlo otra vez.
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Ningún gasto del trámite la está esperando: quedará solo en los documentos del trámite.
            </p>
          )
        )}

        <p className="mt-5 mb-2 text-xs font-semibold text-slate-600">2. Tome la foto o elija el archivo</p>
        <SelectorArchivos archivos={archivos} onCambio={setArchivos} deshabilitado={enviando} />
      </HojaInferior>
    </>
  )
}
