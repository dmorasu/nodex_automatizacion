"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { toast } from "react-toastify"
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { AlertTriangle, ArrowRight, CheckCircle2, FileDown, Info, Loader2, MapPin, Plus, Printer, RotateCcw, X } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import BuscadorMunicipioServidor, { type MunicipioElegido } from "@/components/tramitador/BuscadorMunicipioServidor"
import {
  DESTINOS, ORIGENES, esCorreoGpa, flujoPermitido, formatoTelefono, normalizar, observacionesAutomaticas, reglaPago, tamanoAutomatico,
  type Destino, type OpcionesRotulo, type Origen, type RotuloCreado, type TramiteParaRotulo, type TramitadorRotulo, type VistaPrevia
} from "@/src/rotulos"

const claseInput = "w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500"
const claseTarjeta = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
const claseBoton = "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
const claseBotonPrincipal = "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"

type TramiteEnvio = TramiteParaRotulo & { placaEnvio: string }
type Estado = {
  origen: Origen
  destino: Destino
  tramites: TramiteEnvio[]
  tipo: string
  contenido: string
  detalle: string
  operacionId: number | null
  solicitante: string
  transportadora: string
  contraentrega: boolean
  asegurado: boolean
  valorDeclarado: string
  remSedeId: number | null
  remContacto: string
  remTelefono: string
  remTramitadorId: number | null
  destSedeId: number | null
  destTramitadorId: number | null
  destNombre: string
  destDocumento: string
  destContacto: string
  destTelefono: string
  destCorreo: string
  destDireccion: string
  destMunicipio: MunicipioElegido | null
  observaciones: string | null
  tamano: "carta" | "peq" | null
}

const telefonoUtil = (t: string | null | undefined) => (String(t ?? "").replace(/\D/g, "").length >= 7 ? String(t).trim() : "")
const correoTramitador = (t: TramitadorRotulo | undefined) => (t?.correo && !esCorreoGpa(t.correo) ? t.correo : "")

const estadoInicial = (o: OpcionesRotulo, t: TramiteParaRotulo | null, usuario: string): Estado => {
  const bogota = o.sedes.find(s => normalizar(`${s.nombre} ${s.ciudad}`).includes("BOGOTA")) ?? o.sedes[0]
  const otra = o.sedes.find(s => s.id !== bogota?.id) ?? bogota
  const vacio: Estado = {
    origen: "gpa", destino: "cliente", tramites: [],
    tipo: o.tipos[0] ?? "", contenido: "", detalle: "", operacionId: null, solicitante: "",
    transportadora: o.transportadoras.find(x => normalizar(x).startsWith("ENVIA")) ?? o.transportadoras[0] ?? "",
    contraentrega: false, asegurado: false, valorDeclarado: "",
    remSedeId: bogota?.id ?? null, remContacto: usuario, remTelefono: "", remTramitadorId: null,
    destSedeId: otra?.id ?? null, destTramitadorId: null, destNombre: "", destDocumento: "", destContacto: "",
    destTelefono: "", destCorreo: "", destDireccion: "", destMunicipio: null, observaciones: null, tamano: null
  }
  return t ? conPrellenado(vacio, t, o) : vacio
}

// Lo que trae el trámite llena los campos que estén vacíos
const conPrellenado = (e: Estado, t: TramiteParaRotulo, o: OpcionesRotulo): Estado => {
  const tram = o.tramitadores.find(x => x.id === t.tramitadorId)
  return {
    ...e,
    tramites: e.tramites.some(x => x.id === t.id) ? e.tramites : [...e.tramites, { ...t, placaEnvio: t.placa }],
    operacionId: e.operacionId ?? t.operacionId,
    solicitante: e.solicitante || t.solicitante,
    remTramitadorId: e.remTramitadorId ?? (tram ? tram.id : null),
    destTramitadorId: e.destTramitadorId ?? (tram ? tram.id : null),
    destNombre: e.destNombre || t.cliente?.nombre || "",
    destDocumento: e.destDocumento || t.cliente?.identificacion || "",
    destTelefono: e.destTelefono || telefonoUtil(t.cliente?.telefono),
    destCorreo: e.destCorreo || correoTramitador(tram)
  }
}

const entradaDe = (e: Estado) => ({
  origen: e.origen,
  destino: e.destino,
  tramites: e.tramites.map(t => ({ id: t.id, placa: t.placaEnvio })),
  tipo: e.tipo, contenido: e.contenido, detalle: e.detalle, operacionId: e.operacionId, solicitante: e.solicitante,
  transportadora: e.transportadora, contraentrega: e.contraentrega, asegurado: e.asegurado,
  valorDeclarado: e.asegurado ? Number(e.valorDeclarado.replace(/\D/g, "")) || null : null,
  remitente: e.origen === "gpa"
    ? { sedeId: e.remSedeId, contacto: e.remContacto, telefono: e.remTelefono }
    : { tramitadorId: e.remTramitadorId },
  destinatario: e.destino === "gpa"
    ? { sedeId: e.destSedeId, contacto: e.destContacto, telefono: e.destTelefono }
    : e.destino === "tram"
      ? { tramitadorId: e.destTramitadorId, correo: e.destCorreo }
      : {
          nombre: e.destNombre, documento: e.destDocumento, contacto: e.destContacto, telefono: e.destTelefono,
          correo: e.destino === "cliente" ? e.destCorreo : "", direccion: e.destDireccion, municipioId: e.destMunicipio?.id ?? null
        },
  observaciones: e.observaciones,
  tamano: e.tamano
})

function Campo({ etiqueta, requerido, ayuda, className, children }: { etiqueta: string, requerido?: boolean, ayuda?: React.ReactNode, className?: string, children: React.ReactNode }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{etiqueta}{requerido && <span className="text-red-500"> *</span>}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px] text-slate-400">{ayuda}</span>}
    </label>
  )
}

function Seccion({ numero, titulo, children }: { numero: number, titulo: string, children: React.ReactNode }) {
  return (
    <section className={claseTarjeta}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[11px] text-white">{numero}</span>{titulo}
      </h2>
      {children}
    </section>
  )
}

function SiNo({ valor, onCambio, deshabilitado, etiquetas = ["No", "Sí"] }: { valor: boolean, onCambio: (v: boolean) => void, deshabilitado?: boolean, etiquetas?: [string, string] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group">
      {[false, true].map(v => (
        <button key={String(v)} type="button" disabled={deshabilitado} onClick={() => onCambio(v)} aria-pressed={valor === v}
          className={clsx("min-w-14 rounded-md px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed", valor === v ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")}>
          {etiquetas[Number(v)]}
        </button>
      ))}
    </div>
  )
}

// Tramitador del directorio, por nombre o municipio
function SelectorTramitador({ tramitadores, valor, onElegir }: { tramitadores: TramitadorRotulo[], valor: number | null, onElegir: (t: TramitadorRotulo | null) => void }) {
  const [texto, setTexto] = useState("")
  const elegido = tramitadores.find(t => t.id === valor) ?? null
  const q = normalizar(texto)
  const lista = (q ? tramitadores.filter(t => normalizar(`${t.nombre} ${t.municipio ?? ""} ${t.departamento ?? ""}`).includes(q)) : tramitadores).slice(0, 40)
  return (
    <Combobox value={elegido} onChange={(t: TramitadorRotulo | null) => { onElegir(t); setTexto("") }} onClose={() => setTexto("")}>
      <ComboboxInput className={claseInput} displayValue={(t: TramitadorRotulo | null) => t?.nombre ?? ""} onChange={e => setTexto(e.target.value)} placeholder="Busque por nombre o municipio" />
      <ComboboxOptions anchor="bottom start" className="z-[70] max-h-64 w-[var(--input-width)] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg empty:invisible">
        {lista.map(t => (
          <ComboboxOption key={t.id} value={t} className="cursor-pointer px-3 py-1.5 data-[focus]:bg-sky-50">
            <span className="font-medium text-slate-700">{t.nombre}</span>
            <span className="text-slate-400"> · {t.municipio || "sin municipio"}{t.esMensajero ? " · mensajero" : ""}</span>
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  )
}

function DatosTramitador({ t }: { t: TramitadorRotulo | undefined }) {
  if (!t) return null
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <dt className="text-slate-400">Cédula</dt><dd className="text-slate-700">{t.cedula || "—"}</dd>
      <dt className="text-slate-400">Teléfono</dt><dd className="text-slate-700">{formatoTelefono(t.celular) || "—"}</dd>
      <dt className="text-slate-400">Municipio</dt><dd className="text-slate-700">{[t.municipio, t.departamento].filter(Boolean).join(", ") || "—"}</dd>
      <dt className="text-slate-400">Dirección</dt>
      <dd className={t.direccion ? "text-slate-700" : "font-semibold text-amber-700"}>{t.direccion || "Sin dirección: complétela en Catálogos → Tramitadores"}</dd>
    </dl>
  )
}

export default function GeneradorRotulo({ opciones, tramiteInicial, usuario }: {
  opciones: OpcionesRotulo
  tramiteInicial: TramiteParaRotulo | null
  usuario: string
}) {
  const [e, setE] = useState<Estado>(() => estadoInicial(opciones, tramiteInicial, usuario))
  const cambiar = (parcial: Partial<Estado>) => setE(actual => ({ ...actual, ...parcial }))

  const [nuevoTramite, setNuevoTramite] = useState("")
  const [agregando, setAgregando] = useState(false)
  const [previa, setPrevia] = useState<{ cuerpo: string, datos: VistaPrevia | null, error: string | null, url: string | null }>({ cuerpo: "", datos: null, error: null, url: null })
  const [confirmar, setConfirmar] = useState(false)
  const [llenarLogistica, setLlenarLogistica] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [creado, setCreado] = useState<RotuloCreado | null>(null)
  const urlAnterior = useRef<string | null>(null)

  const operacion = opciones.operaciones.find(o => o.id === e.operacionId)
  const regla = reglaPago(e.origen, e.destino, operacion?.nombre ?? "", e.contraentrega)
  const remTram = opciones.tramitadores.find(t => t.id === e.remTramitadorId)
  const destTram = opciones.tramitadores.find(t => t.id === e.destTramitadorId)
  const remSede = opciones.sedes.find(s => s.id === e.remSedeId)
  const destSede = opciones.sedes.find(s => s.id === e.destSedeId)
  const obsAuto = observacionesAutomaticas(e.origen, e.destino, opciones)
  const tamano = e.tamano ?? tamanoAutomatico(e.tipo, e.contenido)

  // Vista previa: el PDF real del backend, 600 ms después del último cambio
  const cuerpo = useMemo(() => JSON.stringify(entradaDe(e)), [e])
  useEffect(() => {
    let vigente = true
    const espera = setTimeout(async () => {
      const r = await llamarApi<VistaPrevia>("/rotulos/vista-previa", "POST", JSON.parse(cuerpo))
      if (!vigente) return
      if (!r.ok) { setPrevia(p => ({ ...p, cuerpo, error: r.error })); return }
      const bytes = Uint8Array.from(atob(r.datos.pdf), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }))
      if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current)
      urlAnterior.current = url
      setPrevia({ cuerpo, datos: r.datos, error: null, url })
    }, 600)
    return () => { vigente = false; clearTimeout(espera) }
  }, [cuerpo])
  useEffect(() => () => { if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current) }, [])

  const actualizando = previa.cuerpo !== cuerpo
  const faltan = previa.datos?.faltan ?? []

  const agregarTramite = async () => {
    const id = Number(nuevoTramite.replace(/\D/g, ""))
    if (!id) return
    if (e.tramites.some(t => t.id === id)) { toast.info(`El trámite #${id} ya está en el envío`); return }
    setAgregando(true)
    const r = await llamarApi<TramiteParaRotulo>(`/rotulos/tramite/${id}`)
    setAgregando(false)
    if (!r.ok) { toast.error(r.error); return }
    setE(actual => conPrellenado(actual, r.datos, opciones))
    setNuevoTramite("")
  }

  const elegirOrigen = (origen: Origen) => cambiar({ origen, destino: flujoPermitido(origen, e.destino) ? e.destino : "gpa" })

  const generar = async () => {
    setGenerando(true)
    const r = await llamarApi<RotuloCreado>("/rotulos", "POST", { ...JSON.parse(cuerpo), llenarLogistica })
    setGenerando(false)
    if (!r.ok) { toast.error(r.error); return }
    setConfirmar(false)
    setCreado(r.datos)
    toast.success("Rótulo generado y guardado en los documentos del trámite")
  }

  const nuevo = () => { setCreado(null); setE(estadoInicial(opciones, null, usuario)) }

  const resumen: [string, string][] = [
    ["Envío", `${ORIGENES.find(o => o.v === e.origen)?.nombre} → ${DESTINOS.find(d => d.v === e.destino)?.nombre}`],
    ["Trámites", e.tramites.map(t => `#${t.id}${t.placaEnvio ? ` (${t.placaEnvio})` : ""}`).join(", ")],
    ["Destinatario", e.destino === "tram" ? destTram?.nombre ?? "" : e.destino === "gpa" ? `${destSede?.nombre ?? ""} · ${e.destContacto}` : e.destNombre],
    ["Ciudad", e.destino === "tram" ? destTram?.municipio ?? "" : e.destino === "gpa" ? destSede?.ciudad ?? "" : e.destMunicipio ? `${e.destMunicipio.nombreMunicipio}, ${e.destMunicipio.departamento}` : ""],
    ["Contenido", [e.tipo, e.contenido].filter(Boolean).join(" · ")],
    ["Paga el envío", previa.datos?.paga === "DESTINATARIO" ? "El destinatario (contraentrega)" : "Gómez Pineda Abogados"],
    ["Tamaño", tamano === "peq" ? "Pequeño (sobre)" : "Carta"]
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <datalist id="rotuloContenidos">{opciones.contenidos.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="rotuloSolicitantes">{opciones.solicitantes.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="rotuloTransportadoras">{opciones.transportadoras.map(c => <option key={c} value={c} />)}</datalist>

      {/* ── FORMULARIO ── */}
      <div className="space-y-4">
        <Seccion numero={1} titulo="¿Quién envía y a quién?">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1.6fr] sm:items-start">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Envía</p>
              <div className="flex flex-wrap gap-2">
                {ORIGENES.map(o => (
                  <button key={o.v} type="button" onClick={() => elegirOrigen(o.v)} aria-pressed={e.origen === o.v}
                    className={clsx("rounded-lg border px-3 py-2 text-xs font-semibold transition", e.origen === o.v ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                    {o.nombre}
                  </button>
                ))}
              </div>
            </div>
            <ArrowRight size={18} className="hidden text-slate-300 sm:mt-8 sm:block" />
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recibe</p>
              <div className="flex flex-wrap gap-2">
                {DESTINOS.map(d => (
                  <button key={d.v} type="button" disabled={!flujoPermitido(e.origen, d.v)} onClick={() => cambiar({ destino: d.v })} aria-pressed={e.destino === d.v}
                    className={clsx("rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                      e.destino === d.v ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 enabled:hover:bg-slate-50")}>
                    {d.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Seccion>

        <Seccion numero={2} titulo="Datos del envío">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">Trámites Nodex del envío<span className="text-red-500"> *</span></p>
              <div className="space-y-2">
                {e.tramites.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Link href={`/center/solicitudTramites/${t.id}`} target="_blank" className="w-20 shrink-0 text-sm font-semibold text-sky-700 hover:underline">#{t.id}</Link>
                    <input value={t.placaEnvio} onChange={ev => cambiar({ tramites: e.tramites.map((x, j) => (j === i ? { ...x, placaEnvio: ev.target.value.toUpperCase() } : x)) })}
                      placeholder="Placa o matrícula" className={clsx(claseInput, "w-40")} aria-label={`Placa del trámite ${t.id}`} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{t.nombreTramite}</span>
                    <button type="button" onClick={() => cambiar({ tramites: e.tramites.filter(x => x.id !== t.id) })} className="text-slate-300 hover:text-red-500" aria-label={`Quitar el trámite ${t.id}`}><X size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input value={nuevoTramite} onChange={ev => setNuevoTramite(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") { ev.preventDefault(); void agregarTramite() } }}
                  inputMode="numeric" placeholder="N.° de trámite, ej: 5697" className={clsx(claseInput, "w-48")} aria-label="Número de trámite para agregar" />
                <button type="button" onClick={agregarTramite} disabled={agregando || !nuevoTramite.trim()} className={claseBoton}>
                  {agregando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar trámite
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Un envío puede llevar varios trámites (por ejemplo, varias placas del mismo cliente). El rótulo queda en los documentos de cada uno.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Tipo de envío" requerido>
                <select value={e.tipo} onChange={ev => cambiar({ tipo: ev.target.value })} className={claseInput}>
                  {opciones.tipos.map(t => <option key={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Contenido del envío" requerido>
                <input value={e.contenido} onChange={ev => cambiar({ contenido: ev.target.value })} list="rotuloContenidos" placeholder="Seleccione o escriba" className={claseInput} />
              </Campo>
              <Campo etiqueta="Detalle">
                <input value={e.detalle} onChange={ev => cambiar({ detalle: ev.target.value })} placeholder="Ej: Improntas" className={claseInput} />
              </Campo>
              <Campo etiqueta="Línea de negocio (operación)" requerido ayuda={operacion ? `Centro de costos ${operacion.centroDeCostos || "sin definir"}` : undefined}>
                <select value={e.operacionId ?? ""} onChange={ev => cambiar({ operacionId: Number(ev.target.value) || null })} className={claseInput}>
                  <option value="">Seleccione…</option>
                  {opciones.operaciones.map(o => <option key={o.id} value={o.id}>{o.nombre}{o.centroDeCostos ? ` (${o.centroDeCostos})` : ""}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Solicitante del envío" requerido>
                <input value={e.solicitante} onChange={ev => cambiar({ solicitante: ev.target.value })} list="rotuloSolicitantes" placeholder="Seleccione o escriba" className={claseInput} />
              </Campo>
              <Campo etiqueta="Transportadora">
                <input value={e.transportadora} onChange={ev => cambiar({ transportadora: ev.target.value })} list="rotuloTransportadoras" className={claseInput} />
              </Campo>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">¿Pago contraentrega?</p>
                <SiNo valor={regla.contraentrega} deshabilitado={Boolean(regla.fijo)} onCambio={v => cambiar({ contraentrega: v })} />
                <p className="mt-1 text-[11px] text-slate-400">{regla.fijo || (regla.pagaDestinatario ? "Lo paga el destinatario: su identificación y su correo de facturación son obligatorios." : "Lo asume Gómez Pineda Abogados.")}</p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">¿Asegurar envío?</p>
                <div className="flex flex-wrap items-center gap-2">
                  <SiNo valor={e.asegurado} onCambio={v => cambiar({ asegurado: v })} />
                  {e.asegurado && (
                    <input value={e.valorDeclarado} onChange={ev => cambiar({ valorDeclarado: ev.target.value.replace(/\D/g, "") ? Number(ev.target.value.replace(/\D/g, "")).toLocaleString("es-CO") : "" })}
                      inputMode="numeric" placeholder="Valor declarado $" className={clsx(claseInput, "w-40")} aria-label="Valor declarado" />
                  )}
                </div>
              </div>
            </div>
            {regla.pagaDestinatario && (
              <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={15} className="mt-px shrink-0" /> Contraentrega: el costo lo asume el destinatario y la factura sale a su nombre.
              </p>
            )}
          </div>
        </Seccion>

        <Seccion numero={3} titulo="Remitente">
          {e.origen === "gpa" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Oficina que envía" requerido>
                <select value={e.remSedeId ?? ""} onChange={ev => cambiar({ remSedeId: Number(ev.target.value) || null })} className={claseInput}>
                  {opciones.sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Ciudad y dirección">
                <p className="pt-2 text-xs text-slate-600">{[remSede?.ciudad, remSede?.direccion].filter(Boolean).join(" · ") || "—"}</p>
              </Campo>
              <Campo etiqueta="Contacto remitente" requerido>
                <input value={e.remContacto} onChange={ev => cambiar({ remContacto: ev.target.value })} placeholder="Quién entrega el paquete" className={claseInput} />
              </Campo>
              <Campo etiqueta="Teléfono remitente">
                <input value={e.remTelefono} onChange={ev => cambiar({ remTelefono: ev.target.value })} inputMode="tel" placeholder={formatoTelefono(remSede?.celular) || "Teléfono"} className={claseInput} />
              </Campo>
              <p className="text-[11px] text-slate-400 sm:col-span-2">Remitente: {opciones.gpa.razon} · NIT {opciones.gpa.nit} · {opciones.gpa.correo}</p>
            </div>
          ) : (
            <div>
              <Campo etiqueta="Tramitador que envía" requerido>
                <SelectorTramitador tramitadores={opciones.tramitadores} valor={e.remTramitadorId} onElegir={t => cambiar({ remTramitadorId: t?.id ?? null })} />
              </Campo>
              <DatosTramitador t={remTram} />
              <p className="mt-2 text-[11px] text-slate-400">{e.destino === "gpa" ? "Se factura a Gómez Pineda Abogados (destinatario)." : `Remitente: ${opciones.gpa.razon} · NIT ${opciones.gpa.nit}, a través de su tramitador.`}</p>
            </div>
          )}
        </Seccion>

        <Seccion numero={4} titulo="Destinatario">
          {e.destino === "cliente" || e.destino === "tercero" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta={e.destino === "tercero" ? "Tercero (notaría, oficina de tránsito, entidad…)" : "Destinatario (persona o empresa)"} requerido className="sm:col-span-2">
                <input value={e.destNombre} onChange={ev => cambiar({ destNombre: ev.target.value })} className={claseInput} />
              </Campo>
              <Campo etiqueta={e.destino === "tercero" ? "NIT del tercero" : "Identificación o NIT"} requerido={regla.pagaDestinatario}>
                <input value={e.destDocumento} onChange={ev => cambiar({ destDocumento: ev.target.value })} className={claseInput} />
              </Campo>
              <Campo etiqueta="Contacto">
                <input value={e.destContacto} onChange={ev => cambiar({ destContacto: ev.target.value })} className={claseInput} />
              </Campo>
              <Campo etiqueta="Teléfono" requerido>
                <input value={e.destTelefono} onChange={ev => cambiar({ destTelefono: ev.target.value })} inputMode="tel" className={claseInput} />
              </Campo>
              {e.destino === "cliente" && (
                <Campo etiqueta="Correo de facturación electrónica" requerido={regla.pagaDestinatario}>
                  <input value={e.destCorreo} onChange={ev => cambiar({ destCorreo: ev.target.value })} type="email" className={claseInput} />
                </Campo>
              )}
              <Campo etiqueta="Municipio" requerido className="sm:col-span-2">
                <BuscadorMunicipioServidor valor={e.destMunicipio} onElegir={m => cambiar({ destMunicipio: m })} className={claseInput} placeholder="Escriba el municipio" />
              </Campo>
              <Campo etiqueta="Dirección" requerido className="sm:col-span-2">
                <input value={e.destDireccion} onChange={ev => cambiar({ destDireccion: ev.target.value })} placeholder="Dirección o nombre del lugar" className={claseInput} />
              </Campo>
              {e.tramites[0]?.direccion && (
                <button type="button" className={clsx(claseBoton, "sm:col-span-2 justify-start")}
                  onClick={() => {
                    const t = e.tramites[0]
                    cambiar({
                      destDireccion: t.direccion.slice(0, 250),
                      destMunicipio: e.destMunicipio ?? (t.municipio ? { id: t.municipio.id, nombreMunicipio: t.municipio.nombre, departamento: t.municipio.departamento } : null)
                    })
                  }}>
                  <MapPin size={14} /> Usar la dirección del trámite #{e.tramites[0].id}
                </button>
              )}
            </div>
          ) : e.destino === "tram" ? (
            <div>
              <Campo etiqueta="Tramitador que recibe" requerido>
                <SelectorTramitador tramitadores={opciones.tramitadores} valor={e.destTramitadorId}
                  onElegir={t => cambiar({ destTramitadorId: t?.id ?? null, destCorreo: e.destCorreo || correoTramitador(t ?? undefined) })} />
              </Campo>
              <DatosTramitador t={destTram} />
              {regla.pagaDestinatario && (
                <Campo etiqueta="Correo de facturación electrónica del tramitador (contraentrega)" requerido className="mt-3">
                  <input value={e.destCorreo} onChange={ev => cambiar({ destCorreo: ev.target.value })} type="email" className={claseInput} />
                </Campo>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Oficina que recibe" requerido>
                <select value={e.destSedeId ?? ""} onChange={ev => cambiar({ destSedeId: Number(ev.target.value) || null })} className={claseInput}>
                  {opciones.sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Ciudad y dirección">
                <p className="pt-2 text-xs text-slate-600">{[destSede?.ciudad, destSede?.direccion].filter(Boolean).join(" · ") || "—"}</p>
              </Campo>
              <Campo etiqueta="Contacto que recibe" requerido>
                <input value={e.destContacto} onChange={ev => cambiar({ destContacto: ev.target.value })} className={claseInput} />
              </Campo>
              <Campo etiqueta="Teléfono">
                <input value={e.destTelefono} onChange={ev => cambiar({ destTelefono: ev.target.value })} inputMode="tel" className={claseInput} />
              </Campo>
            </div>
          )}
        </Seccion>

        <Seccion numero={5} titulo="Observaciones">
          <textarea value={e.observaciones ?? obsAuto} onChange={ev => cambiar({ observaciones: ev.target.value })} rows={4} className={clsx(claseInput, "h-auto py-2")} aria-label="Observaciones" />
          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex-1">{e.observaciones === null ? "Se llenan solas según el envío; puede editarlas." : "Editadas a mano."}</span>
            {e.observaciones !== null && (
              <button type="button" onClick={() => cambiar({ observaciones: null })} className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"><RotateCcw size={12} /> Usar las de siempre</button>
            )}
          </div>
        </Seccion>
      </div>

      {/* ── VISTA PREVIA ── */}
      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className={clsx(claseTarjeta, "space-y-3")}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-sm font-semibold text-slate-800">Vista previa</h2>
            {actualizando && <Loader2 size={15} className="animate-spin text-slate-400" aria-label="Actualizando" />}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Tamaño">
              {(["carta", "peq"] as const).map(v => (
                <button key={v} type="button" onClick={() => cambiar({ tamano: v })} aria-pressed={tamano === v}
                  className={clsx("rounded-md px-3 py-1.5 text-xs font-semibold", tamano === v ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")}>
                  {v === "carta" ? "Carta" : "Pequeño"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {tamano === "peq" ? "Formato pequeño (15 cm de ancho) para recortar y pegar en el sobre de la tarjeta de propiedad." : "Tamaño carta."}
            {e.tamano === null && " Elegido según el tipo y el contenido."}
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {previa.url
              ? <iframe key={previa.url} src={`${previa.url}#toolbar=0&navpanes=0&view=FitH`} title="Vista previa del rótulo" className="h-[70vh] min-h-[420px] w-full" />
              : <div className="flex h-[420px] items-center justify-center text-xs text-slate-400">{previa.error ?? "Armando la vista previa…"}</div>}
          </div>

          {creado ? (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
              <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 size={17} /> Rótulo generado</p>
              <p>Quedó en los documentos de {creado.tramites.map(t => `#${t}`).join(", ")}.
                {creado.logisticas.length > 0 && ` La logística de ${creado.logisticas.map(t => `#${t}`).join(", ")} tomó la transportadora y el destinatario.`}</p>
              {!creado.transportadoraEnCatalogo && <p className="text-amber-800">La transportadora no está en el catálogo de Logística: no se puso en la logística.</p>}
              <div className="flex flex-wrap gap-2">
                <a href={`/api/backend/rotulos/${creado.id}/pdf`} target="_blank" rel="noreferrer" className={claseBotonPrincipal}><Printer size={14} /> Abrir para imprimir</a>
                {creado.tramites[0] && <Link href={`/center/solicitudTramites/${creado.tramites[0]}`} className={claseBoton}>Ir al trámite #{creado.tramites[0]}</Link>}
                <button type="button" onClick={nuevo} className={claseBoton}><Plus size={14} /> Nuevo rótulo</button>
              </div>
            </div>
          ) : (
            <>
              {previa.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{previa.error}</p>}
              {faltan.length > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-slate-700">
                  <p className="flex items-center gap-1.5 font-semibold text-sky-800"><Info size={14} /> Falta para generar el rótulo</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">{faltan.map(f => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {previa.url && <a href={previa.url} download="vista-previa-rotulo.pdf" className={claseBoton}><FileDown size={14} /> Descargar borrador</a>}
                <button type="button" onClick={() => setConfirmar(true)} disabled={actualizando || !previa.datos || faltan.length > 0} className={claseBotonPrincipal}>
                  <Printer size={14} /> Generar rótulo
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {confirmar && (
        <Dialog open onClose={() => !generando && setConfirmar(false)} className="relative z-50">
          <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
              <DialogTitle className="text-base font-semibold text-slate-800">¿Generar el rótulo?</DialogTitle>
              <p className="mt-1 text-xs text-slate-500">Revise los datos. El PDF queda en los documentos de cada trámite del envío.</p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                {resumen.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd className="font-medium text-slate-700">{v || "—"}</dd></div>)}
              </dl>
              <label className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <input type="checkbox" checked={llenarLogistica} onChange={ev => setLlenarLogistica(ev.target.checked)} className="mt-0.5" />
                <span>Llenar la logística de los trámites con la transportadora y el destinatario (solo lo que esté vacío; la guía se registra después en Logística).</span>
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmar(false)} disabled={generando} className={claseBoton}>Revisar de nuevo</button>
                <button type="button" onClick={generar} disabled={generando} className={claseBotonPrincipal}>
                  {generando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Sí, generar
                </button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </div>
  )
}
