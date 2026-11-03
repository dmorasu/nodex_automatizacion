"use client"

import { useImperativeHandle, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Camera, CheckCircle2, Eraser, Loader2, MessageSquareWarning, PenLine, Plus, X } from "lucide-react"
import { agregarAdicional, aprobarCuenta, guardarFirma, pedirCorreccion } from "@/actions/cuentasCobro"
import { comprimirImagen } from "@/src/lib/comprimirImagen"
import { formatoMoneda } from "@/src/lib/formato"
import type { CuentaCobro } from "@/src/schemas"
import HojaInferior from "../ui/HojaInferior"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseSelect, claseTextarea } from "../ui/estilos"

// Aprobar la cuenta (con la firma guardada o dibujándola), pedir corrección o agregar un
// adicional con soporte (vuelve a Torre de control para revisión)
export default function AccionesCuenta({ id, numero, total, estado, tieneFirma, tramites, hoy }: {
  id: number
  numero: string
  total: number
  estado: CuentaCobro["estado"]
  tieneFirma: boolean
  tramites: { tramiteId: number, placa: string | null }[]
  hoy: string
}) {
  const router = useRouter()
  const [hoja, setHoja] = useState<"aprobar" | "corregir" | "adicional" | null>(null)
  const [nuevaFirma, setNuevaFirma] = useState(!tieneFirma)
  const [comentario, setComentario] = useState("")
  const [enviando, startEnviar] = useTransition()
  const lienzo = useRef<PadFirmaRef>(null)

  if (estado !== "CON_TRAMITADOR") return null

  const terminado = (mensaje: string) => {
    toast.success(mensaje)
    setHoja(null)
    router.refresh()
  }

  const cerrar = () => {
    if (enviando) return
    setHoja(null)
    setNuevaFirma(!tieneFirma)
  }

  const aprobar = () => startEnviar(async () => {
    if (nuevaFirma) {
      const imagen = lienzo.current?.imagen()
      if (!imagen) return void toast.error("Dibuje su firma")
      const firma = await guardarFirma(imagen)
      if (!firma.ok) return firma.errores.forEach(e => toast.error(e))
    }
    const resultado = await aprobarCuenta(id)
    if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
    toast.success("Cuenta de cobro aprobada")
    setHoja(null)
    router.refresh()
  })

  const corregir = () => startEnviar(async () => {
    if (!comentario.trim()) return void toast.error("Cuéntenos qué hay que corregir")
    const resultado = await pedirCorreccion(id, comentario.trim())
    if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
    toast.success("Enviamos su solicitud de corrección")
    setHoja(null)
    setComentario("")
    router.refresh()
  })

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setHoja("adicional")} className={`${claseBotonSecundario} col-span-2`}>
          <Plus size={17} /> Agregar adicional
        </button>
        <button type="button" onClick={() => setHoja("corregir")} className={claseBotonSecundario}>
          <MessageSquareWarning size={17} /> Pedir corrección
        </button>
        <button type="button" onClick={() => setHoja("aprobar")} className={claseBotonPrimario}>
          <CheckCircle2 size={17} /> Aprobar
        </button>
      </div>

      {hoja === "adicional" && (
        <HojaAdicional id={id} tramites={tramites} hoy={hoy} onCerrar={() => setHoja(null)} onListo={() => terminado("Adicional enviado a Torre de control para revisión")} />
      )}

      <HojaInferior
        abierta={hoja === "aprobar"}
        onCerrar={cerrar}
        titulo={`Aprobar ${numero}`}
        descripcion={`${formatoMoneda(total / 100)} · Su firma va en la cuenta de cobro y en el anexo.`}
        pie={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={cerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={aprobar} disabled={enviando} className={claseBotonPrimario}>
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {enviando ? "Aprobando..." : "Aprobar y firmar"}
            </button>
          </div>
        }
      >
        {nuevaFirma ? (
          <PadFirma ref={lienzo} />
        ) : (
          <div className="space-y-2">
            <div className="flex h-36 items-center justify-center rounded-xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/firma" alt="Su firma" className="max-h-32 max-w-full object-contain" />
            </div>
            <button type="button" onClick={() => setNuevaFirma(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
              <PenLine size={15} /> Cambiar firma
            </button>
          </div>
        )}
      </HojaInferior>

      <HojaInferior
        abierta={hoja === "corregir"}
        onCerrar={cerrar}
        titulo={`Pedir corrección de ${numero}`}
        pie={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={cerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={corregir} disabled={enviando || !comentario.trim()} className={claseBotonPrimario}>
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">¿Qué hay que corregir?</span>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={4} maxLength={1000}
            placeholder="Ej: falta la visita fallida del trámite 5095" className={claseTextarea} />
        </label>
      </HojaInferior>
    </>
  )
}

// Papelería, impresiones, sobres… con la foto o el PDF del soporte
function HojaAdicional({ id, tramites, hoy, onCerrar, onListo }: {
  id: number
  tramites: { tramiteId: number, placa: string | null }[]
  hoy: string
  onCerrar: () => void
  onListo: () => void
}) {
  const [tramite, setTramite] = useState(tramites.length === 1 ? String(tramites[0].tramiteId) : "")
  const [concepto, setConcepto] = useState("")
  const [fecha, setFecha] = useState(hoy)
  const [valor, setValor] = useState("")
  const [soporte, setSoporte] = useState<File | null>(null)
  const [enviando, startEnviar] = useTransition()
  const selector = useRef<HTMLInputElement>(null)

  const elegir = async (archivos: FileList | null) => {
    const archivo = archivos?.[0]
    if (!archivo) return
    if (archivo.type === "application/pdf") return setSoporte(archivo)
    if (!archivo.type.startsWith("image/")) return void toast.error("El soporte debe ser una foto o un PDF")
    setSoporte(await comprimirImagen(archivo))
  }

  const enviar = () => {
    if (!tramite || !concepto.trim() || !fecha || !Number(valor)) return toast.error("Complete el trámite, el concepto, la fecha y el valor")
    if (!soporte) return toast.error("Adjunte el soporte")
    const datos = new FormData()
    datos.append("solicitudTramiteId", tramite)
    datos.append("concepto", concepto.trim())
    datos.append("fecha", fecha)
    datos.append("valor", valor)
    datos.append("soporte", soporte)
    startEnviar(async () => {
      const resultado = await agregarAdicional(id, datos)
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      onListo()
    })
  }

  return (
    <HojaInferior
      abierta
      onCerrar={() => !enviando && onCerrar()}
      titulo="Agregar adicional"
      descripcion="La cuenta vuelve a Torre de control para revisarlo."
      pie={
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onCerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
          <button type="button" onClick={enviar} disabled={enviando} className={claseBotonPrimario}>
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={claseLabel}>Trámite</span>
          <select value={tramite} onChange={e => setTramite(e.target.value)} className={claseSelect}>
            <option value="">Elija el trámite</option>
            {tramites.map(t => <option key={t.tramiteId} value={t.tramiteId}>#{t.tramiteId}{t.placa ? ` · ${t.placa}` : ""}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={claseLabel}>Concepto</span>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} maxLength={200} placeholder="Ej: papelería, sobres, impresiones" className={claseInput} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={claseLabel}>Fecha</span>
            <input type="date" value={fecha} max={hoy} onChange={e => setFecha(e.target.value)} className={claseInput} />
          </label>
          <label className="block">
            <span className={claseLabel}>Valor</span>
            <input inputMode="numeric" value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ""))} placeholder="0" className={`${claseInput} text-right`} />
          </label>
        </div>
        <div>
          <span className={claseLabel}>Soporte</span>
          <input ref={selector} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { void elegir(e.target.files); e.target.value = "" }} />
          {soporte ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{soporte.name}</span>
              <button type="button" onClick={() => setSoporte(null)} className="p-2 text-slate-400 active:text-red-600" aria-label="Quitar soporte"><X size={18} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => selector.current?.click()} className={`${claseBotonSecundario} w-full`}>
              <Camera size={17} /> Foto o PDF
            </button>
          )}
        </div>
      </div>
    </HojaInferior>
  )
}

type PadFirmaRef = { imagen: () => string | null }

// Lienzo para firmar con el dedo. Devuelve un PNG con fondo transparente (null si está vacío).
function PadFirma({ ref }: { ref: React.Ref<PadFirmaRef> }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const [vacio, setVacio] = useState(true)

  // El lienzo usa la densidad de la pantalla para que la firma no salga borrosa
  const preparar = (canvas: HTMLCanvasElement | null) => {
    lienzo.current = canvas
    if (!canvas || canvas.dataset.listo) return
    const escala = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * escala
    canvas.height = canvas.clientHeight * escala
    const ctx = canvas.getContext("2d")!
    ctx.scale(escala, escala)
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
    canvas.dataset.listo = "si"
  }

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - caja.left, y: e.clientY - caja.top }
  }

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujando.current = true
    const { x, y } = punto(e)
    const ctx = e.currentTarget.getContext("2d")!
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    setVacio(false)
  }

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    const { x, y } = punto(e)
    const ctx = e.currentTarget.getContext("2d")!
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const borrar = () => {
    const canvas = lienzo.current
    if (!canvas) return
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
  }

  useImperativeHandle(ref, () => ({
    imagen: () => (vacio || !lienzo.current ? null : lienzo.current.toDataURL("image/png"))
  }), [vacio])

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-slate-600">Firme aquí con el dedo</span>
      <canvas
        ref={preparar}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={() => { dibujando.current = false }}
        onPointerCancel={() => { dibujando.current = false }}
        className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
      />
      <button type="button" onClick={borrar} disabled={vacio} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 disabled:opacity-40">
        <Eraser size={15} /> Borrar
      </button>
    </div>
  )
}
