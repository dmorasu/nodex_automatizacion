"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "react-toastify"
import clsx from "clsx"
import { Camera, CheckCircle2, Loader2, LocateFixed, LocateOff, X, XCircle } from "lucide-react"
import { confirmarVisita } from "@/actions/ruta"
import { comprimirImagen } from "@/src/lib/comprimirImagen"
import HojaInferior from "../ui/HojaInferior"
import { claseBotonPrimario, claseBotonSecundario, claseTextarea } from "../ui/estilos"

type Estado = "ENTREGADO" | "NO_SE_PUDO"
type Gps = { estado: "buscando" } | { estado: "listo", latitud: number, longitud: number, precision: number } | { estado: "sin", motivo: string }

// Confirmar la visita: Entregado o No se pudo, con foto y la ubicación del celular.
// La ubicación sirve como prueba de que la visita se hizo en el lugar.
export default function ConfirmarVisita({ paradaId, tramiteId, estadoActual }: { paradaId: number, tramiteId: number, estadoActual: string }) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [observacion, setObservacion] = useState("")
  const [foto, setFoto] = useState<{ archivo: File, vista: string } | null>(null)
  const [gps, setGps] = useState<Gps>({ estado: "buscando" })
  const [enviando, startEnviar] = useTransition()
  const camara = useRef<HTMLInputElement>(null)

  // Al abrir se pide la ubicación (el celular pregunta la primera vez)
  const tomarUbicacion = () => {
    if (!("geolocation" in navigator)) return setGps({ estado: "sin", motivo: "Este celular no permite obtener la ubicación" })
    setGps({ estado: "buscando" })
    navigator.geolocation.getCurrentPosition(
      p => setGps({ estado: "listo", latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy }),
      error => setGps({
        estado: "sin",
        motivo: error.code === error.PERMISSION_DENIED ? "Permiso de ubicación negado: actívelo en el navegador" : "No se pudo obtener la ubicación"
      }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    )
  }

  const abrir = () => {
    setAbierto(true)
    tomarUbicacion()
  }

  const quitarFoto = () => {
    if (foto) URL.revokeObjectURL(foto.vista)
    setFoto(null)
  }

  const reiniciar = () => {
    setAbierto(false)
    setEstado(null)
    setObservacion("")
    quitarFoto()
  }

  const cerrar = () => {
    if (!enviando) reiniciar()
  }

  const elegirFoto = async (archivos: FileList | null) => {
    const archivo = archivos?.[0]
    if (!archivo) return
    if (!archivo.type.startsWith("image/")) return toast.error("Debe ser una foto")
    const comprimida = await comprimirImagen(archivo)
    quitarFoto()
    setFoto({ archivo: comprimida, vista: URL.createObjectURL(comprimida) })
  }

  const enviar = () => {
    if (!estado) return toast.error("Indique si se entregó o no se pudo")
    if (estado === "NO_SE_PUDO" && !observacion.trim()) return toast.error("Cuente por qué no se pudo hacer la visita")

    const datos = new FormData()
    datos.append("estado", estado)
    if (observacion.trim()) datos.append("observacion", observacion.trim())
    if (gps.estado === "listo") {
      datos.append("latitud", String(gps.latitud))
      datos.append("longitud", String(gps.longitud))
      datos.append("precision", String(Math.round(gps.precision)))
    }
    if (foto) datos.append("foto", foto.archivo)

    startEnviar(async () => {
      const resultado = await confirmarVisita(paradaId, datos)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success(estado === "ENTREGADO" ? "Visita confirmada" : "Novedad registrada")
      reiniciar()
    })
  }

  return (
    <>
      <button type="button" onClick={abrir} className={`${estadoActual === "PENDIENTE" ? claseBotonPrimario : claseBotonSecundario} w-full`}>
        <CheckCircle2 size={17} />
        {estadoActual === "PENDIENTE" ? "Confirmar visita" : "Cambiar confirmación"}
      </button>

      <HojaInferior
        abierta={abierto}
        onCerrar={cerrar}
        titulo={`Visita · Trámite #${tramiteId}`}
        descripcion="Torre de control ve la confirmación, la foto y dónde estaba al confirmar."
        pie={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={cerrar} disabled={enviando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={enviar} disabled={enviando || !estado} className={claseBotonPrimario}>
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {enviando ? "Enviando..." : "Confirmar"}
            </button>
          </div>
        }
      >
        {/* Resultado */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { valor: "ENTREGADO", nombre: "Entregado", Icono: CheckCircle2, activo: "border-emerald-500 bg-emerald-50 text-emerald-700" },
            { valor: "NO_SE_PUDO", nombre: "No se pudo", Icono: XCircle, activo: "border-red-500 bg-red-50 text-red-700" }
          ] as const).map(({ valor, nombre, Icono, activo }) => (
            <button
              key={valor}
              type="button"
              onClick={() => setEstado(valor)}
              aria-pressed={estado === valor}
              className={clsx("flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold transition",
                estado === valor ? activo : "border-slate-200 text-slate-600")}
            >
              <Icono size={22} />
              {nombre}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            Observación {estado === "NO_SE_PUDO" && <span className="text-red-500">*</span>}
          </span>
          <textarea
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={estado === "NO_SE_PUDO" ? "¿Qué pasó? Ej: no había nadie, dirección errada…" : "Opcional"}
            className={claseTextarea}
          />
        </label>

        {/* Foto */}
        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Foto (recomendada)</span>
          <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { elegirFoto(e.target.files); e.target.value = "" }} />
          {foto ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.vista} alt="Foto de la visita" className="h-14 w-14 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">Foto lista</span>
              <button type="button" onClick={quitarFoto} className="p-2 text-slate-400 active:text-red-600" aria-label="Quitar foto"><X size={18} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => camara.current?.click()} className={`${claseBotonSecundario} w-full`}>
              <Camera size={17} /> Tomar foto
            </button>
          )}
        </div>

        {/* Ubicación del celular */}
        <div className={clsx("mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
          gps.estado === "listo" ? "bg-emerald-50 text-emerald-800" : gps.estado === "sin" ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600")}>
          {gps.estado === "sin" ? <LocateOff size={17} className="mt-0.5 shrink-0" /> : <LocateFixed size={17} className="mt-0.5 shrink-0" />}
          <div className="min-w-0 flex-1">
            {gps.estado === "buscando" && "Obteniendo su ubicación…"}
            {gps.estado === "listo" && `Ubicación tomada (precisión ±${Math.round(gps.precision)} m)`}
            {gps.estado === "sin" && <>{gps.motivo}. Puede confirmar igual.</>}
          </div>
          {gps.estado === "sin" && (
            <button type="button" onClick={tomarUbicacion} className="shrink-0 text-xs font-semibold underline">Reintentar</button>
          )}
        </div>
      </HojaInferior>
    </>
  )
}
