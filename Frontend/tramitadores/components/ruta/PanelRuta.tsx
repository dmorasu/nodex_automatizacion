"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Flag, Loader2, LocateFixed, Play, Utensils } from "lucide-react"
import HojaInferior from "../ui/HojaInferior"
import { claseBotonPrimario, claseBotonSecundario, claseTarjeta } from "../ui/estilos"
import { finalizarJornada, iniciarJornada, marcarAlmuerzo } from "@/actions/ruta"
import { iniciarRuta, rutaIniciada, ubicacionAutorizada } from "@/src/lib/enRuta"
import { posicionActual } from "@/src/lib/gps"
import type { JornadaDelDia, Ruta } from "@/src/schemas"

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })
const duracion = (minutos: number) => (minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`)
const km = (valor: number) => `${valor.toLocaleString("es-CO", { maximumFractionDigits: 1 })} km`

// Rutas del día (PESV): iniciar ruta (con la autorización de ubicación la primera vez), almuerzo
// y finalizar ruta; debajo, las rutas ya hechas hoy con su tiempo y km.
export default function PanelRuta({ jornadaAbierta, jornadas }: { jornadaAbierta: Ruta["jornadaAbierta"], jornadas: JornadaDelDia[] }) {
  const [autorizando, setAutorizando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [ocupado, startOcupado] = useTransition()

  // Con una ruta abierta la ubicación se comparte (aunque se haya abierto en otro celular)
  useEffect(() => {
    if (jornadaAbierta && !rutaIniciada()) iniciarRuta()
  }, [jornadaAbierta])

  const ejecutar = (accion: () => Promise<{ ok: true } | { ok: false, errores: string[] }>, exito: string, despues?: () => void) =>
    startOcupado(async () => {
      const r = await accion()
      if (!r.ok) return void r.errores.forEach(e => toast.error(e))
      toast.success(exito)
      despues?.()
    })

  const iniciar = () => ejecutar(async () => iniciarJornada(await posicionActual()), "Ruta iniciada", iniciarRuta)
  const pedirInicio = () => (ubicacionAutorizada() ? iniciar() : setAutorizando(true))

  const enCurso = jornadaAbierta ? jornadas.find(j => j.id === jornadaAbierta.id) : null
  const terminadas = jornadas.filter(j => j.fin)

  return (
    <div className="space-y-2">
      {!jornadaAbierta ? (
        <div className={`${claseTarjeta} flex items-start gap-3 p-4`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><LocateFixed size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">{terminadas.length ? "¿Sale a otra ruta?" : "¿Sale a hacer la ruta?"}</p>
            <p className="mt-0.5 text-xs text-slate-500">Inicie la ruta antes de empezar las diligencias.</p>
            <button type="button" onClick={pedirInicio} disabled={ocupado} className={`${claseBotonPrimario} mt-3 w-full`}>
              {ocupado ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />} Iniciar ruta
            </button>
          </div>
        </div>
      ) : (
        <div className={`${claseTarjeta} border-indigo-200 p-4`}>
          <p className="text-sm font-semibold text-slate-800">
            {jornadaAbierta.enAlmuerzo ? "En almuerzo" : "Ruta en curso"}
            <span className="font-normal text-slate-500"> · desde {hora(jornadaAbierta.inicio)}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {jornadaAbierta.fecha !== new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
              ? `Es una ruta del ${jornadaAbierta.fecha} que no se finalizó: finalícela.`
              : enCurso ? `${duracion(enCurso.minutosEfectivos)} efectivos · ${km(enCurso.km)}${enCurso.minutosAlmuerzo ? ` · almuerzo ${duracion(enCurso.minutosAlmuerzo)}` : ""}` : ""}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => ejecutar(() => marcarAlmuerzo(jornadaAbierta.enAlmuerzo ? "terminar" : "iniciar"), jornadaAbierta.enAlmuerzo ? "Almuerzo terminado" : "Buen provecho")}
              className={claseBotonSecundario}
            >
              <Utensils size={16} /> {jornadaAbierta.enAlmuerzo ? "Volver del almuerzo" : "Salir a almorzar"}
            </button>
            <button type="button" disabled={ocupado} onClick={() => setFinalizando(true)} className={claseBotonSecundario}>
              <Flag size={16} /> Finalizar ruta
            </button>
          </div>
        </div>
      )}

      {/* Rutas ya terminadas hoy */}
      {terminadas.map((j, i) => (
        <p key={j.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <b>Ruta {i + 1}</b> · {hora(j.inicio)} a {hora(j.fin!)} · {duracion(j.minutosEfectivos)} efectivos
          {j.minutosAlmuerzo > 0 && ` · almuerzo ${duracion(j.minutosAlmuerzo)}`} · {km(j.km)}
        </p>
      ))}

      <HojaInferior
        abierta={finalizando}
        onCerrar={() => setFinalizando(false)}
        titulo="¿Finalizar la ruta?"
        descripcion="Se guarda la hora de fin y los kilómetros recorridos. Puede iniciar otra ruta después."
        pie={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFinalizando(false)} className={claseBotonSecundario}>Cancelar</button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => ejecutar(async () => finalizarJornada(await posicionActual()), "Ruta finalizada", () => setFinalizando(false))}
              className={claseBotonPrimario}
            >
              {ocupado && <Loader2 size={16} className="animate-spin" />} Finalizar
            </button>
          </div>
        }
      >
        <div className="pb-2" />
      </HojaInferior>

      <HojaInferior
        abierta={autorizando}
        onCerrar={() => setAutorizando(false)}
        titulo="Compartir su ubicación"
        pie={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAutorizando(false)} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={() => { setAutorizando(false); iniciar() }} className={claseBotonPrimario}>Autorizo</button>
          </div>
        }
      >
        <div className="space-y-2 pb-4 text-sm text-slate-600">
          <p>Al iniciar la ruta, la app envía su ubicación a Torre de control <b>más o menos cada minuto</b> y guarda la hora de inicio y fin de la ruta y de cada diligencia, para el seguimiento del día y el Plan Estratégico de Seguridad Vial (PESV).</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Solo mientras tenga <b>esta app abierta</b>; arriba verá un aviso mientras comparte.</li>
            <li>Queda activa todo el día: si cierra la app deja de enviar, y al abrirla de nuevo sigue compartiendo.</li>
            <li>Solo la ve Torre de control. Las posiciones se borran a los 60 días; los tiempos y kilómetros de cada ruta se guardan como historial.</li>
          </ul>
          <p>El celular le pedirá permiso de ubicación: elija <b>Permitir</b>.</p>
        </div>
      </HojaInferior>
    </div>
  )
}
