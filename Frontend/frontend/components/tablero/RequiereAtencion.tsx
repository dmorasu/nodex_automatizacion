"use client"

import { useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { ArrowRight, CheckCircle2, ChevronRight, CircleCheck, Flame, TriangleAlert, type LucideIcon } from "lucide-react"
import EstadoTramite from "@/components/solicitudTramites/EstadoTramite"
import { fechaCorta, miles, type ClaveAlerta, type Tablero, type TramiteAlerta } from "@/src/tablero"
import type { TipoAccion } from "@/components/gestionMasiva/camposAcciones"

// Semáforo: rojo = urgente, amarillo = revisar, verde = solo falta cerrarlo
type Nivel = "rojo" | "amarillo" | "verde"

type Definicion = {
  clave: ClaveAlerta
  nombre: string
  nivel: Nivel
  descripcion: (diasGracia: number) => string
  // Columna de días que se resalta en la lista
  dias?: (t: TramiteAlerta) => string
  // Acción que abre la Gestión masiva con los trámites marcados (ya elegida; se pueden sumar otras allá)
  masiva?: { accion: TipoAccion, texto: string }
  // Sin acción masiva: enlace a la página donde se resuelve
  enlace?: { href: string, texto: string }
}

const CAMBIAR_ESTADO = { accion: "estados", texto: "Cambiar estado" } as const
const AGREGAR_TRAZABILIDAD = { accion: "trazabilidad", texto: "Agregar trazabilidad" } as const

const ALERTAS: Definicion[] = [
  {
    clave: "vencenHoy",
    masiva: CAMBIAR_ESTADO,
    nivel: "rojo",
    nombre: "Vencen hoy",
    descripcion: () => "Trámites abiertos cuya fecha de entrega del resultado es hoy."
  },
  {
    clave: "vencidos",
    nivel: "rojo",
    nombre: "Vencidos",
    descripcion: d => `Pasaron más de ${d} días desde la fecha de programación y no están finalizados (sin contar los que están en espera por novedad).`,
    dias: t => `${t.diasAtraso} días de atraso`,
    masiva: CAMBIAR_ESTADO
  },
  {
    clave: "enNovedad",
    nivel: "amarillo",
    nombre: "En espera por novedad",
    descripcion: () => "Trámites en espera por novedad (no cuentan como vencidos). Primero los que llevan más días.",
    dias: t => `${t.diasEnNovedad} días en novedad`,
    masiva: AGREGAR_TRAZABILIDAD
  },
  {
    clave: "realizadoSinFinalizar",
    masiva: CAMBIAR_ESTADO,
    nivel: "verde",
    nombre: "Realizado sin finalizar",
    descripcion: () => "El tramitador lo reportó como realizado en su app, pero el trámite sigue abierto."
  },
  {
    clave: "sinTramitador",
    masiva: { accion: "tramitador", texto: "Asignar tramitador" },
    nivel: "amarillo",
    nombre: "Sin tramitador",
    descripcion: () => "Trámites abiertos sin tramitador asignado."
  },
  {
    clave: "sinProgramacion",
    masiva: { accion: "programacion", texto: "Programar" },
    nivel: "amarillo",
    nombre: "Sin programación",
    descripcion: () => "Trámites sin iniciar y sin fecha de diligencia."
  },
  {
    clave: "sinMovimiento",
    nivel: "amarillo",
    nombre: "Sin movimiento",
    descripcion: d => `Abiertos (sin contar novedades) con más de ${d} días sin trazabilidad ni cambio de estado.`,
    dias: t => `${t.diasSinMovimiento} días sin movimiento`,
    masiva: AGREGAR_TRAZABILIDAD
  },
  {
    clave: "sinAnalista",
    enlace: { href: "/center/analistas", texto: "Asignar en Analistas" },
    nivel: "amarillo",
    nombre: "Sin analista",
    descripcion: () => "Trámites abiertos sin analista asignado."
  }
]

// Cada nivel con un color sólido bien distinto y su propio ícono (se distingue también sin
// color). Pestaña con trámites: blanca con el punto y el contador del color del nivel;
// seleccionada: rellena con ese color. En 0: gris. Sobre amarillo el texto va oscuro.
const NIVELES: Record<Nivel, {
  titulo: string
  icono: LucideIcon
  punto: string
  contador: string
  seleccionada: string
  barra: string
  textoIcono: string
}> = {
  rojo: {
    titulo: "Urgente",
    icono: Flame,
    punto: "bg-red-600",
    contador: "bg-red-600 text-white",
    seleccionada: "border-red-600 bg-red-600 text-white shadow-sm",
    barra: "border-l-red-600",
    textoIcono: "text-red-600"
  },
  amarillo: {
    titulo: "Revisar",
    icono: TriangleAlert,
    punto: "bg-yellow-400",
    contador: "bg-yellow-400 text-slate-900",
    seleccionada: "border-yellow-400 bg-yellow-400 text-slate-900 shadow-sm",
    barra: "border-l-yellow-400",
    textoIcono: "text-yellow-600"
  },
  verde: {
    titulo: "Por cerrar",
    icono: CircleCheck,
    punto: "bg-emerald-600",
    contador: "bg-emerald-600 text-white",
    seleccionada: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    barra: "border-l-emerald-600",
    textoIcono: "text-emerald-600"
  }
}

// Orden del semáforo: primero lo urgente
const ORDEN_NIVELES: Nivel[] = ["rojo", "amarillo", "verde"]

// Lo que hay que atender: cada alerta lista sus trámites con enlace al detalle
export default function RequiereAtencion({ tablero, mostrarSinAnalista }: { tablero: Tablero, mostrarSinAnalista: boolean }) {
  const alertas = ALERTAS.filter(a => mostrarSinAnalista || a.clave !== "sinAnalista")
  const [activa, setActiva] = useState<ClaveAlerta>(
    alertas.find(a => tablero.atencion[a.clave].total > 0)?.clave ?? "vencidos"
  )

  // Trámites marcados de la alerta abierta (se limpia al cambiar de alerta)
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const abrirAlerta = (clave: ClaveAlerta) => {
    setActiva(clave)
    setSeleccion(new Set())
  }
  const alternar = (id: number) => setSeleccion(actual => {
    const nueva = new Set(actual)
    if (nueva.has(id)) nueva.delete(id)
    else nueva.add(id)
    return nueva
  })

  const definicion = alertas.find(a => a.clave === activa)!
  const lista = tablero.atencion[activa]
  const nivelActivo = NIVELES[definicion.nivel]
  const IconoActivo = nivelActivo.icono
  const { masiva, enlace } = definicion
  const todosMarcados = lista.items.length > 0 && lista.items.every(t => seleccion.has(t.id))
  const urlMasiva = masiva && `/center/gestionMasiva?accion=${masiva.accion}&ids=${[...seleccion].join(",")}`

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Requiere atención</h2>
        <p className="mt-0.5 text-xs text-slate-400">Trámites abiertos que necesitan acción. Clic en un trámite para abrirlo.</p>
      </div>

      {/* Pestañas agrupadas por nivel del semáforo, cada una con su cantidad */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-6">
        {ORDEN_NIVELES.map(nivel => {
          const delNivel = alertas.filter(a => a.nivel === nivel)
          if (!delNivel.length) return null
          const { titulo, icono: Icono, textoIcono } = NIVELES[nivel]
          return (
            <div key={nivel} className="min-w-0">
              <p className={clsx("mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide", textoIcono)}>
                <Icono size={13} aria-hidden="true" />
                {titulo}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {delNivel.map(a => {
                  const total = tablero.atencion[a.clave].total
                  const colores = NIVELES[a.nivel]
                  const seleccionada = activa === a.clave
                  return (
                    <button
                      key={a.clave}
                      type="button"
                      onClick={() => abrirAlerta(a.clave)}
                      aria-pressed={seleccionada}
                      className={clsx(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                        seleccionada
                          ? (total > 0 ? colores.seleccionada : "border-slate-500 bg-slate-500 text-white")
                          : (total > 0 ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50")
                      )}
                    >
                      {!seleccionada && (
                        <span className={clsx("h-2 w-2 shrink-0 rounded-full", total > 0 ? colores.punto : "bg-slate-300")} aria-hidden="true" />
                      )}
                      {a.nombre}
                      <span className={clsx(
                        "rounded-full px-1.5 text-[10px] font-bold",
                        seleccionada
                          ? "bg-white/90 text-slate-900"
                          : (total > 0 ? colores.contador : "bg-slate-100 text-slate-400")
                      )}>
                        {miles(total)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 py-4">
        {/* La alerta elegida, marcada con el color e ícono de su nivel */}
        <p className={clsx("mb-3 flex items-start gap-2 border-l-4 pl-2.5 text-xs text-slate-600", nivelActivo.barra)}>
          <IconoActivo size={14} className={clsx("mt-px shrink-0", nivelActivo.textoIcono)} aria-hidden="true" />
          <span><span className="font-semibold text-slate-700">{nivelActivo.titulo} · {definicion.nombre}.</span> {definicion.descripcion(tablero.diasGracia)}</span>
        </p>

        {lista.total === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-6 text-xs text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
            Nada pendiente en esta alerta.
          </p>
        ) : (
          <>
            {/* Marcar trámites y gestionarlos juntos en la Gestión masiva */}
            {masiva && (
              <div className="mb-2 flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={() => setSeleccion(todosMarcados ? new Set() : new Set(lista.items.map(t => t.id)))}
                    className="h-4 w-4 accent-sky-500"
                  />
                  Marcar todos ({miles(lista.items.length)})
                </label>
                {seleccion.size > 0 && (
                  <>
                    <span className="font-semibold text-slate-700">{miles(seleccion.size)} marcado{seleccion.size === 1 ? "" : "s"}</span>
                    <Link
                      href={urlMasiva!}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500 px-3 font-semibold text-white shadow-sm hover:bg-sky-600"
                    >
                      {masiva.texto}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                    <button type="button" onClick={() => setSeleccion(new Set())} className="text-slate-400 hover:text-slate-600">
                      Quitar marcas
                    </button>
                  </>
                )}
              </div>
            )}
            {enlace && (
              <Link href={enlace.href} className="mb-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
                {enlace.texto}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}

            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {lista.items.map(t => (
                <li key={t.id} className={clsx("flex items-stretch", seleccion.has(t.id) && "bg-sky-50/60")}>
                  {masiva && (
                    <label className="flex shrink-0 cursor-pointer items-center pl-4 pr-1">
                      <input
                        type="checkbox"
                        checked={seleccion.has(t.id)}
                        onChange={() => alternar(t.id)}
                        className="h-4 w-4 accent-sky-500"
                        aria-label={`Marcar trámite ${t.id}`}
                      />
                    </label>
                  )}
                  <Link
                    href={`/center/solicitudTramites/${t.id}`}
                    className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs transition hover:bg-sky-50/50"
                  >
                    <span className="w-16 shrink-0 font-semibold text-slate-700">#{t.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-700">{t.tipo ?? "Sin tipo"} · {t.cliente ?? "Sin cliente"}</span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {t.placa ?? "—"} · Analista: {t.analista ?? "—"} · Tramitador: {t.tramitador ?? "—"}
                        {t.fechaProgramada && ` · Programado ${fechaCorta(t.fechaProgramada)}`}
                      </span>
                    </span>
                    {t.ultimaGestion && (
                      <span className="w-36 shrink-0 text-[11px] leading-4">
                        <span className="block text-slate-600">Últ. gestión {fechaCorta(t.ultimaGestion)} {t.ultimaGestion.slice(11, 16)}</span>
                        <span className="block truncate text-slate-400">{t.ultimaGestionTipo}</span>
                      </span>
                    )}
                    <EstadoTramite nombre={t.estado} />
                    {definicion.dias && (
                      <span className="w-36 shrink-0 text-right font-semibold text-slate-700">{definicion.dias(t)}</span>
                    )}
                    <ChevronRight size={15} className="shrink-0 text-slate-300 group-hover:text-sky-500" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {lista.total > lista.items.length && (
              <p className="mt-2 text-[11px] text-slate-400">
                Se muestran los {lista.items.length} primeros de {miles(lista.total)}. Use los filtros para acotar.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
