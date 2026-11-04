"use client"

import clsx from "clsx"
import { toast } from "react-toastify"
import { Copy, MapPin, MessageCircle } from "lucide-react"
import {
  MESES, celular, distancia, enlaceRuta, etiquetas, textoDistancia, tituloMunicipio,
  type MunicipioDirectorio, type PersonaDirectorio, type Tono
} from "@/src/directorio"

const TONOS: Record<Tono, string> = {
  alerta: "border-amber-200 bg-amber-50 text-amber-700",
  bien: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-slate-200 bg-slate-50 text-slate-600"
}

export const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("")

export function Avatar({ persona, pequeno }: { persona: PersonaDirectorio, pequeno?: boolean }) {
  return (
    <span className={clsx("flex shrink-0 items-center justify-center rounded-full font-semibold",
      pequeno ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs",
      persona.esMensajero ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700")} aria-hidden="true">
      {iniciales(persona.nombre)}
    </span>
  )
}

export function Etiquetas({ persona }: { persona: PersonaDirectorio }) {
  const lista = etiquetas(persona)
  if (!lista.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {lista.map(e => <span key={e.texto} className={clsx("rounded-full border px-2 py-px text-[10px] font-semibold", TONOS[e.tono])}>{e.texto}</span>)}
    </span>
  )
}

function Copiar({ valor, etiqueta }: { valor: string, etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(valor); toast.success(`${etiqueta} copiado`) } catch { toast.error("No se pudo copiar") }
      }}
      className="shrink-0 rounded p-0.5 text-slate-300 hover:text-sky-600"
      aria-label={`Copiar ${etiqueta}`}
      title="Copiar"
    >
      <Copy size={13} />
    </button>
  )
}

// Ficha de un tramitador o mensajero: contacto (con copiar), cobertura y datos de pago.
// Con `municipio`, muestra la distancia aproximada desde donde reside
export default function FichaPersona({ persona, municipios, municipio, onMunicipio, completa }: {
  persona: PersonaDirectorio
  municipios: Map<number, MunicipioDirectorio>
  municipio?: MunicipioDirectorio | null
  onMunicipio?: (id: number) => void
  completa?: boolean
}) {
  const residencia = persona.residenciaId ? municipios.get(persona.residenciaId) : undefined
  const cubre = persona.cobertura.map(id => municipios.get(id)).filter((m): m is MunicipioDirectorio => Boolean(m))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  const LIMITE = completa ? cubre.length : 10
  const cel = celular(persona.whatsapp)
  const d = municipio ? distancia(residencia, municipio) : null

  const datos: [string, React.ReactNode][] = []
  if (cel) datos.push(["Celular", <>
    <span>{cel}</span><Copiar valor={cel.replace(/\s/g, "")} etiqueta="Celular" />
    {persona.whatsapp && (
      <a href={`https://wa.me/${persona.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="shrink-0 text-emerald-600 hover:text-emerald-700" title="Abrir WhatsApp" aria-label="Abrir WhatsApp">
        <MessageCircle size={13} />
      </a>
    )}
  </>])
  if (persona.correo) datos.push(["Correo", <><span className="break-all">{persona.correo}</span><Copiar valor={persona.correo} etiqueta="Correo" /></>])
  if (persona.correoPersonal && persona.correoPersonal.toLowerCase() !== persona.correo?.toLowerCase()) {
    datos.push(["Correo personal", <><span className="break-all">{persona.correoPersonal}</span><Copiar valor={persona.correoPersonal} etiqueta="Correo" /></>])
  }
  if (persona.direccion) datos.push(["Dirección envíos", <><span>{persona.direccion}</span><Copiar valor={persona.direccion} etiqueta="Dirección" /></>])
  if (persona.cumpleDia && persona.cumpleMes) datos.push(["Cumpleaños", `${persona.cumpleDia} de ${MESES[persona.cumpleMes - 1]}`])
  if (persona.esMensajero && persona.sede) datos.push(["Sede", persona.sede])

  const pago: [string, string][] = []
  if (persona.banco) pago.push(["Entidad", persona.banco])
  if (persona.tarjetaAmparada != null) pago.push(["Tarjeta amparada GPA", persona.tarjetaAmparada ? "Sí" : "No"])
  if (persona.tiempoPago) pago.push(["Tiempo de pago", persona.tiempoPago])

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar persona={persona} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{persona.nombre}</p>
          {persona.identificacion && (
            <p className="flex items-center gap-1 text-xs font-medium text-slate-600">
              C.C. {/^\d+$/.test(persona.identificacion) ? Number(persona.identificacion).toLocaleString("es-CO") : persona.identificacion}
              <Copiar valor={persona.identificacion} etiqueta="Cédula" />
            </p>
          )}
          <p className="text-[11px] text-slate-400">Reside en {residencia ? `${tituloMunicipio(residencia.nombre)}, ${tituloMunicipio(residencia.departamento)}` : persona.ciudad || "—"}</p>
        </div>
        <span className={clsx("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          persona.esMensajero ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700")}>
          {persona.esMensajero ? "Mensajero propio" : "Tramitador"}
        </span>
      </div>

      {municipio && (
        <div className={clsx("flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
          !d ? "bg-slate-50 text-slate-400" : d.minutos <= 90 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
          <MapPin size={14} className="mt-0.5 shrink-0" />
          {!residencia ? <span>Municipio de residencia sin registrar (Catálogos → Tramitadores).</span>
            : !d ? <span>Reside en {tituloMunicipio(residencia.nombre)} · distancia no disponible</span>
              : d.km === 0 ? <span>Reside en {tituloMunicipio(municipio.nombre)}</span>
                : <span>
                    Desde {tituloMunicipio(residencia.nombre)}: <b>{textoDistancia(d)}</b> (estimado){" "}
                    <a href={enlaceRuta(residencia, municipio)} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">Ver ruta</a>
                  </span>}
        </div>
      )}

      <Etiquetas persona={persona} />

      {datos.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {datos.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-400">{k}</dt>
              <dd className="flex min-w-0 items-start gap-1.5 text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {persona.nota && <p className="rounded-md border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">{persona.nota}</p>}

      <div className="text-xs text-slate-600">
        Cubre {cubre.length} municipio{cubre.length === 1 ? "" : "s"}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {cubre.slice(0, LIMITE).map(m => (
            <button key={m.id} type="button" onClick={() => onMunicipio?.(m.id)} disabled={!onMunicipio}
              className={clsx("rounded-full border px-2 py-0.5 text-[11px] transition",
                m.id === municipio?.id ? "border-sky-300 bg-sky-50 font-semibold text-sky-700" : "border-slate-200 text-slate-600 enabled:hover:border-sky-300 enabled:hover:text-sky-700")}>
              {tituloMunicipio(m.nombre)}
            </button>
          ))}
          {cubre.length > LIMITE && <span className="self-center text-[11px] text-slate-400">+{cubre.length - LIMITE} más</span>}
        </div>
      </div>

      {pago.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-400">Datos de pago</summary>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {pago.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd className="text-slate-700">{v}</dd></div>)}
          </dl>
        </details>
      )}
    </article>
  )
}
