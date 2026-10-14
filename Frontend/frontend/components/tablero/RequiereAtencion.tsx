"use client"

import { useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { CheckCircle2, ChevronRight } from "lucide-react"
import EstadoTramite from "@/components/solicitudTramites/EstadoTramite"
import { fechaCorta, miles, type ClaveAlerta, type Tablero, type TramiteAlerta } from "@/src/tablero"

// Semáforo: rojo = urgente, amarillo = revisar, verde = solo falta cerrarlo
type Nivel = "rojo" | "amarillo" | "verde"

type Definicion = {
  clave: ClaveAlerta
  nombre: string
  nivel: Nivel
  descripcion: (diasGracia: number) => string
  // Columna de días que se resalta en la lista
  dias?: (t: TramiteAlerta) => string
}

const ALERTAS: Definicion[] = [
  {
    clave: "vencenHoy",
    nivel: "rojo",
    nombre: "Vencen hoy",
    descripcion: () => "Trámites abiertos cuya fecha de entrega del resultado es hoy."
  },
  {
    clave: "vencidos",
    nivel: "rojo",
    nombre: "Vencidos",
    descripcion: d => `Pasaron más de ${d} días desde la fecha de programación y no están finalizados (sin contar los que están en espera por novedad).`,
    dias: t => `${t.diasAtraso} días de atraso`
  },
  {
    clave: "enNovedad",
    nivel: "amarillo",
    nombre: "En espera por novedad",
    descripcion: () => "Trámites en espera por novedad (no cuentan como vencidos). Primero los que llevan más días.",
    dias: t => `${t.diasEnNovedad} días en novedad`
  },
  {
    clave: "realizadoSinFinalizar",
    nivel: "verde",
    nombre: "Realizado sin finalizar",
    descripcion: () => "El tramitador lo reportó como realizado en su app, pero el trámite sigue abierto."
  },
  {
    clave: "sinTramitador",
    nivel: "amarillo",
    nombre: "Sin tramitador",
    descripcion: () => "Trámites abiertos sin tramitador asignado."
  },
  {
    clave: "sinProgramacion",
    nivel: "amarillo",
    nombre: "Sin programación",
    descripcion: () => "Trámites abiertos sin fecha de diligencia."
  },
  {
    clave: "sinMovimiento",
    nivel: "amarillo",
    nombre: "Sin movimiento",
    descripcion: d => `Abiertos (sin contar novedades) con más de ${d} días sin trazabilidad ni cambio de estado.`,
    dias: t => `${t.diasSinMovimiento} días sin movimiento`
  },
  {
    clave: "sinAnalista",
    nivel: "amarillo",
    nombre: "Sin analista",
    descripcion: () => "Trámites abiertos sin analista asignado."
  }
]

// Con trámites: borde y fondo del color del nivel; seleccionada: más intensa. En 0: gris.
// Contadores con texto oscuro sobre amarillo (el blanco no se lee sobre ese tono)
const COLORES: Record<Nivel, { inactiva: string, activa: string, contador: string }> = {
  rojo: {
    inactiva: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    activa: "border-red-500 bg-red-100 text-red-800 ring-2 ring-red-200",
    contador: "bg-red-600 text-white"
  },
  amarillo: {
    inactiva: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    activa: "border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-200",
    contador: "bg-amber-400 text-amber-950"
  },
  verde: {
    inactiva: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    activa: "border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200",
    contador: "bg-emerald-600 text-white"
  }
}

// Lo que hay que atender: cada alerta lista sus trámites con enlace al detalle
export default function RequiereAtencion({ tablero, mostrarSinAnalista }: { tablero: Tablero, mostrarSinAnalista: boolean }) {
  const alertas = ALERTAS.filter(a => mostrarSinAnalista || a.clave !== "sinAnalista")
  const [activa, setActiva] = useState<ClaveAlerta>(
    alertas.find(a => tablero.atencion[a.clave].total > 0)?.clave ?? "vencidos"
  )

  const definicion = alertas.find(a => a.clave === activa)!
  const lista = tablero.atencion[activa]

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Requiere atención</h2>
        <p className="mt-0.5 text-xs text-slate-400">Trámites abiertos que necesitan acción. Clic en un trámite para abrirlo.</p>
      </div>

      {/* Una pestaña por alerta, con su cantidad */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
        {alertas.map(a => {
          const total = tablero.atencion[a.clave].total
          const colores = COLORES[a.nivel]
          const seleccionada = activa === a.clave
          return (
            <button
              key={a.clave}
              type="button"
              onClick={() => setActiva(a.clave)}
              aria-pressed={seleccionada}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                total > 0
                  ? (seleccionada ? colores.activa : colores.inactiva)
                  : (seleccionada ? "border-slate-400 bg-slate-100 text-slate-700 ring-2 ring-slate-200" : "border-slate-200 text-slate-500 hover:bg-slate-50")
              )}
            >
              {a.nombre}
              <span className={clsx(
                "rounded-full px-1.5 text-[10px] font-bold",
                total > 0 ? colores.contador : "bg-slate-100 text-slate-400"
              )}>
                {miles(total)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="px-5 py-4">
        <p className="mb-3 text-xs text-slate-500">{definicion.descripcion(tablero.diasGracia)}</p>

        {lista.total === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-6 text-xs text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
            Nada pendiente en esta alerta.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {lista.items.map(t => (
                <li key={t.id}>
                  <Link
                    href={`/center/solicitudTramites/${t.id}`}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs transition hover:bg-sky-50/50"
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
