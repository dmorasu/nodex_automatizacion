"use client"

import { useState } from "react"
import { toast } from "react-toastify"
import { Clock, Loader2, Send } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"

type Resultado = { encontradas: number, enviadas: number, sinTelefono: number, errores: number } | { error: string }

export type NotificacionProgramada = {
  clave: string
  nombre: string
  descripcion: string
  hora: string
  dias: number[]
  activa: boolean
  actualizadoPor: string | null
  actualizadoEn: string | null
  ultimaEjecucion: string | null
  ultimoOrigen: "PROGRAMADA" | "MANUAL" | null
  ultimoEjecutadoPor: string | null
  ultimoResultado: Resultado | null
  proximaEjecucion: string | null
  enEjecucion: boolean
}

// En el orden de la semana colombiana; el valor es el de cron (0 = domingo)
const DIAS = [
  { valor: 1, corto: "L", nombre: "Lunes" },
  { valor: 2, corto: "M", nombre: "Martes" },
  { valor: 3, corto: "M", nombre: "Miércoles" },
  { valor: 4, corto: "J", nombre: "Jueves" },
  { valor: 5, corto: "V", nombre: "Viernes" },
  { valor: 6, corto: "S", nombre: "Sábado" },
  { valor: 0, corto: "D", nombre: "Domingo" },
]
const LUNES_A_VIERNES = [1, 2, 3, 4, 5]
const TODOS = [0, 1, 2, 3, 4, 5, 6]

const mismosDias = (a: number[], b: number[]) => a.length === b.length && a.every(d => b.includes(d))

const fechaHora = (valor: string | null) =>
  valor
    ? new Date(valor).toLocaleString("es-CO", {
      timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"
    })
    : "—"

const textoResultado = (resultado: Resultado | null) => {
  if (!resultado) return null
  if ("error" in resultado) return resultado.error
  const partes = [`${resultado.enviadas} enviada(s) de ${resultado.encontradas} diligencia(s)`]
  if (resultado.sinTelefono) partes.push(`${resultado.sinTelefono} sin teléfono`)
  if (resultado.errores) partes.push(`${resultado.errores} con error`)
  return partes.join(" · ")
}

export default function TarjetaNotificacionProgramada({ inicial }: { inicial: NotificacionProgramada }) {
  const [guardada, setGuardada] = useState(inicial)
  const [hora, setHora] = useState(inicial.hora)
  const [dias, setDias] = useState(inicial.dias)
  const [activa, setActiva] = useState(inicial.activa)
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const cambios = hora !== guardada.hora || activa !== guardada.activa || !mismosDias(dias, guardada.dias)
  const ocupado = guardando || enviando

  const alternarDia = (dia: number) =>
    setDias(actuales => (actuales.includes(dia) ? actuales.filter(d => d !== dia) : [...actuales, dia]))

  const recargar = async () => {
    const lista = await llamarApi<NotificacionProgramada[]>("/notificaciones-programadas")
    const actual = lista.ok ? lista.datos.find(n => n.clave === guardada.clave) : null
    if (actual) setGuardada(actual)
  }

  const guardar = async () => {
    if (activa && dias.length === 0) return toast.error("Elija al menos un día o desactive la notificación")
    setGuardando(true)
    const resultado = await llamarApi<NotificacionProgramada>(
      `/notificaciones-programadas/${guardada.clave}`, "PUT", { hora, dias, activa }
    )
    setGuardando(false)
    if (!resultado.ok) return toast.error(resultado.error)
    setGuardada(resultado.datos)
    setHora(resultado.datos.hora)
    setDias(resultado.datos.dias)
    setActiva(resultado.datos.activa)
    toast.success(resultado.datos.activa ? `${guardada.nombre}: programada` : `${guardada.nombre}: desactivada`)
  }

  const descartar = () => {
    setHora(guardada.hora)
    setDias(guardada.dias)
    setActiva(guardada.activa)
  }

  const enviarAhora = async () => {
    const aviso = [
      `¿Enviar ahora "${guardada.nombre}"?`,
      "Los tramitadores recibirán el WhatsApp en este momento.",
      guardada.activa ? `Si hoy también se envía a la hora programada (${guardada.hora}), lo recibirán dos veces.` : ""
    ].filter(Boolean).join("\n\n")
    if (!confirm(aviso)) return

    setEnviando(true)
    const resultado = await llamarApi<Resultado>(`/notificaciones-programadas/${guardada.clave}/enviar-ahora`, "POST", {})
    setEnviando(false)
    if (!resultado.ok) {
      toast.error(resultado.error)
    } else {
      toast.success(textoResultado(resultado.datos) ?? "Enviado")
    }
    await recargar()
  }

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">

      {/* Encabezado con interruptor */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{guardada.nombre}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{guardada.descripcion}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activa}
          aria-label={activa ? "Desactivar" : "Activar"}
          onClick={() => setActiva(!activa)}
          disabled={ocupado}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60 ${activa ? "bg-sky-500" : "bg-slate-300"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${activa ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Hora y días */}
      <div className={`space-y-4 p-5 transition-opacity ${activa ? "" : "opacity-50"}`}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Hora de envío</span>
          <input
            type="time"
            value={hora}
            onChange={e => setHora(e.target.value)}
            disabled={ocupado || !activa}
            required
            className="h-10 w-36 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Días</span>
            <div className="flex gap-3 text-xs">
              <button type="button" disabled={ocupado || !activa} onClick={() => setDias(LUNES_A_VIERNES)} className="text-sky-600 hover:underline disabled:no-underline disabled:opacity-60">
                Lunes a viernes
              </button>
              <button type="button" disabled={ocupado || !activa} onClick={() => setDias(TODOS)} className="text-sky-600 hover:underline disabled:no-underline disabled:opacity-60">
                Todos
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map(dia => {
              const elegido = dias.includes(dia.valor)
              return (
                <button
                  key={dia.valor}
                  type="button"
                  title={dia.nombre}
                  aria-label={dia.nombre}
                  aria-pressed={elegido}
                  onClick={() => alternarDia(dia.valor)}
                  disabled={ocupado || !activa}
                  className={`h-9 w-9 rounded-full border text-xs font-semibold transition ${elegido
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-sky-300"}`}
                >
                  {dia.corto}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Estado */}
      <dl className="mx-5 space-y-2 rounded-lg bg-slate-50 p-4 text-xs">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-500">Próximo envío</dt>
          <dd className="font-medium text-slate-700">
            {guardada.activa && guardada.proximaEjecucion ? fechaHora(guardada.proximaEjecucion) : "Desactivada"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-500">Último envío</dt>
          <dd className="text-slate-700">
            {guardada.ultimaEjecucion ? (
              <>
                <span className="font-medium">{fechaHora(guardada.ultimaEjecucion)}</span>
                {" · "}
                {guardada.ultimoOrigen === "MANUAL" ? `manual (${guardada.ultimoEjecutadoPor ?? "—"})` : "programado"}
                <span className={`block ${guardada.ultimoResultado && "error" in guardada.ultimoResultado ? "text-red-600" : "text-slate-500"}`}>
                  {textoResultado(guardada.ultimoResultado)}
                </span>
              </>
            ) : "Sin registro todavía"}
          </dd>
        </div>
        {guardada.actualizadoPor && (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-500">Último cambio</dt>
            <dd className="text-slate-700">{guardada.actualizadoPor} · {fechaHora(guardada.actualizadoEn)}</dd>
          </div>
        )}
      </dl>

      {/* Acciones */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 p-5">
        <button
          type="button"
          onClick={enviarAhora}
          disabled={ocupado || cambios || guardada.enEjecucion}
          title={cambios ? "Guarde o descarte los cambios antes de enviar" : undefined}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {enviando || guardada.enEjecucion ? "Enviando…" : "Enviar ahora"}
        </button>

        {cambios && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={descartar} disabled={ocupado} className="h-9 rounded-md px-3 text-xs font-medium text-slate-500 hover:text-slate-700">
              Descartar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
              Guardar cambios
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
