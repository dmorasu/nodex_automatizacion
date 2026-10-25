"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { AlertTriangle, BadgeCheck, Ban, ExternalLink, FileDown, Loader2, Plus, Send, Trash2, Undo2, X } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import Dato from "@/components/ui/Dato"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "@/components/ui/estilos"
import {
  ESTADOS_CUENTA,
  NOMBRE_TIPO_LINEA,
  fechaCorta,
  fechaHora,
  nombreSemana,
  pesos,
  type DetalleCuenta as Detalle,
  type LineaCuenta,
  type TramiteCuenta
} from "@/src/cuentasCobro"

const claseBotonPeligro = `inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-red-200 bg-white text-red-600 text-xs font-semibold transition hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed`
const claseCelda = "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

type Accion = "anular" | "retirar" | null

// Detalle de una cuenta de cobro: el analista corrige valores, agrega visitas fallidas o
// adicionales, quita trámites y la envía al tramitador; después, retirar, anular o visto bueno.
export default function DetalleCuenta({ id, onCerrar, onCambio }: { id: number, onCerrar: () => void, onCambio: () => void }) {
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [accion, setAccion] = useState<Accion>(null)
  const [motivo, setMotivo] = useState("")
  const [agregandoA, setAgregandoA] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const r = await llamarApi<Detalle>(`/cuentas-cobro-tramitadores/${id}`)
    if (r.ok) setDetalle(r.datos)
    else setError(r.error)
  }, [id])

  useEffect(() => {
    let vigente = true
    llamarApi<Detalle>(`/cuentas-cobro-tramitadores/${id}`).then(r => {
      if (!vigente) return
      if (r.ok) setDetalle(r.datos)
      else setError(r.error)
    })
    return () => { vigente = false }
  }, [id])

  // Toda acción devuelve el detalle actualizado (o un mensaje) y refresca la lista de atrás
  const ejecutar = async (ruta: string, metodo: string, cuerpo?: unknown, exito?: string) => {
    setOcupado(true)
    const r = await llamarApi<Detalle | { mensaje: string }>(ruta, metodo, cuerpo)
    setOcupado(false)
    if (!r.ok) {
      toast.error(r.error)
      return false
    }
    if ("numero" in r.datos) setDetalle(r.datos)
    else await cargar()
    if (exito) toast.success(exito)
    onCambio()
    return true
  }

  const base = `/cuentas-cobro-tramitadores/${id}`

  const confirmarAccion = async () => {
    if (accion === "anular" && !motivo.trim()) return toast.error("Indique el motivo")
    const ok = await ejecutar(`${base}/${accion}`, "POST", { motivo }, accion === "anular" ? "Cuenta anulada" : "Cuenta retirada: vuelve a borrador")
    if (ok) {
      setAccion(null)
      setMotivo("")
    }
  }

  return (
    <Dialog open onClose={() => !ocupado && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4">
        <DialogPanel className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            {detalle ? (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-sm font-semibold text-slate-800">Cuenta de cobro {detalle.numero}</DialogTitle>
                  <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", ESTADOS_CUENTA[detalle.estado].clase)}>
                    {ESTADOS_CUENTA[detalle.estado].nombre}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {detalle.tramitador.nombre} · Semana del {nombreSemana(detalle.semana)} · <span className="font-semibold text-slate-700">{pesos(detalle.total)}</span>
                </p>
              </div>
            ) : <DialogTitle className="text-sm font-semibold text-slate-800">Cuenta de cobro</DialogTitle>}
            <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
            {!detalle && !error && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={15} className="animate-spin" /> Cargando…</p>}
            {detalle && (
              <>
                <Avisos detalle={detalle} />
                <DatosTramitador detalle={detalle} />
                <TablaTramites
                  detalle={detalle}
                  ocupado={ocupado}
                  agregandoA={agregandoA}
                  onAgregar={setAgregandoA}
                  onGuardarLinea={(linea, cambios) => ejecutar(`${base}/lineas/${linea.id}`, "PUT", cambios)}
                  onQuitarLinea={linea => {
                    const texto = linea.tipo === "TRAMITE"
                      ? `¿Quitar el trámite #${linea.tramiteId} de la cuenta? Vuelve a "Por generar".`
                      : `¿Quitar "${linea.concepto}"?`
                    if (confirm(texto)) void ejecutar(`${base}/lineas/${linea.id}`, "DELETE")
                  }}
                  onNuevaLinea={async datos => {
                    const ok = await ejecutar(`${base}/lineas`, "POST", datos, "Línea agregada")
                    if (ok) setAgregandoA(null)
                  }}
                />
                <Distribucion detalle={detalle} />
                <Historial detalle={detalle} />
              </>
            )}
          </div>

          {/* Acciones */}
          {detalle && (
            <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
              {accion ? (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-600" htmlFor="motivoCuenta">
                    {accion === "anular" ? "Motivo de la anulación" : "Qué se va a corregir (opcional)"}
                  </label>
                  <textarea id="motivoCuenta" value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={1000}
                    className="w-full resize-y rounded-md border border-slate-200 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => { setAccion(null); setMotivo("") }} disabled={ocupado} className={claseBotonSecundario}>Cancelar</button>
                    <button type="button" onClick={confirmarAccion} disabled={ocupado} className={accion === "anular" ? claseBotonPeligro : claseBotonPrimario}>
                      {ocupado && <Loader2 size={15} className="animate-spin" />}
                      {accion === "anular" ? "Anular la cuenta" : "Retirar para corregir"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {!["EN_TESORERIA", "PAGADA", "ANULADA"].includes(detalle.estado) && (
                    <button type="button" onClick={() => setAccion("anular")} disabled={ocupado} className={clsx(claseBotonPeligro, "mr-auto")}>
                      <Ban size={15} /> Anular
                    </button>
                  )}
                  {detalle.tieneSoportePago && (
                    <a href={`/api/backend${base}/soporte-pago`} target="_blank" rel="noreferrer" className={claseBotonSecundario}>
                      <ExternalLink size={15} /> Soporte de pago
                    </a>
                  )}
                  {detalle.estado !== "ANULADA" && (
                    <a href={`/api/backend${base}/pdf`} target="_blank" rel="noreferrer" className={claseBotonSecundario}>
                      <FileDown size={15} /> {detalle.editable ? "Vista previa del PDF" : "PDF"}
                    </a>
                  )}
                  {(detalle.estado === "CON_TRAMITADOR" || detalle.estado === "APROBADA") && (
                    <button type="button" onClick={() => setAccion("retirar")} disabled={ocupado} className={claseBotonSecundario}>
                      <Undo2 size={15} /> Retirar para corregir
                    </button>
                  )}
                  {detalle.estado === "APROBADA" && (
                    <button type="button" disabled={ocupado} className={claseBotonPrimario}
                      onClick={() => confirm("¿Dar el visto bueno? Pasa a Tesorería para el pago y queda radicada hoy.") &&
                        void ejecutar("/cuentas-cobro-tramitadores/visto-bueno", "POST", { cuentaIds: [id] })}>
                      {ocupado ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />} Visto bueno
                    </button>
                  )}
                  {detalle.editable && (
                    <button type="button" disabled={ocupado || detalle.tramites.length === 0} className={claseBotonPrimario}
                      onClick={() => confirm(`¿Enviar la cuenta ${detalle.numero} a ${detalle.tramitador.nombre} por ${pesos(detalle.total)}?`) &&
                        void ejecutar(`${base}/enviar`, "POST", undefined, "Cuenta enviada al tramitador")}>
                      {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Enviar al tramitador
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}

// Lo que impide enviarla o lo que pidió el tramitador
function Avisos({ detalle }: { detalle: Detalle }) {
  // Lo que hizo el tramitador desde el último envío (el historial viene del más reciente al más antiguo)
  const delTramitador: Detalle["historial"] = []
  if (detalle.estado === "POR_CORREGIR") {
    for (const h of detalle.historial) {
      if (h.accion === "Enviada al tramitador") break
      if (h.esTramitador) delTramitador.push(h)
    }
  }
  return (
    <>
      {delTramitador.map(h => (
        <div key={h.id} className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">{h.accion} · {h.nombre} · {fechaHora(h.fecha)}</p>
          <p className="mt-1 whitespace-pre-line">{h.detalle}</p>
        </div>
      ))}
      {detalle.editable && detalle.faltantes.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle size={14} /> Faltan datos del tramitador: {detalle.faltantes.join(", ")}.
          <Link href="/center/catalogos?pestana=tramitadores" className="font-semibold underline">Completar en Tramitadores</Link>
        </p>
      )}
      {detalle.editable && !detalle.tramitador.tieneAcceso && (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle size={14} /> {detalle.tramitador.nombre} no tiene acceso a la app de tramitadores.
        </p>
      )}
      {detalle.estado === "ANULADA" && detalle.motivoAnulacion && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">Anulada: {detalle.motivoAnulacion}</p>
      )}
    </>
  )
}

function DatosTramitador({ detalle }: { detalle: Detalle }) {
  const t = detalle.tramitador
  const cuenta = [t.banco, t.tipoCuenta && t.tipoCuenta !== "BILLETERA" ? t.tipoCuenta.toLowerCase() : null, t.numeroCuenta].filter(Boolean).join(" · ")
  return (
    <dl className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-3 lg:grid-cols-4">
      <Dato etiqueta="Identificación" valor={t.identificacion} />
      <Dato etiqueta="Dirección" valor={t.direccion} />
      <Dato etiqueta="Ciudad" valor={t.ciudad} />
      <Dato etiqueta="Teléfono" valor={t.telefono} />
      <Dato etiqueta="Correo" valor={t.correo} />
      <Dato etiqueta="Cuenta" valor={cuenta} />
      <Dato etiqueta="Declaración art. 383" valor={t.declaracionArt383 ? "Sí" : "No"} />
      <Dato etiqueta="Fechas" valor={[
        detalle.enviadaEn && `Enviada ${fechaHora(detalle.enviadaEn)}`,
        detalle.aprobadaEn && `Aprobada ${fechaHora(detalle.aprobadaEn)}`,
        detalle.fechaRadicacion && `Radicada ${fechaCorta(detalle.fechaRadicacion)}${detalle.vistoBuenoPor ? ` (${detalle.vistoBuenoPor})` : ""}`,
        detalle.fechaPago && `Pagada ${fechaCorta(detalle.fechaPago)}`
      ].filter(Boolean).join(" · ") || null} />
    </dl>
  )
}

type NuevaLinea = { solicitudTramiteId: number, tipo: "VISITA_FALLIDA" | "ADICIONAL", concepto: string, fecha: string, valor: number }

function TablaTramites({ detalle, ocupado, agregandoA, onAgregar, onGuardarLinea, onQuitarLinea, onNuevaLinea }: {
  detalle: Detalle
  ocupado: boolean
  agregandoA: number | null
  onAgregar: (tramiteId: number | null) => void
  onGuardarLinea: (linea: LineaCuenta, cambios: Partial<{ valor: number, concepto: string, fecha: string }>) => Promise<boolean>
  onQuitarLinea: (linea: LineaCuenta) => void
  onNuevaLinea: (datos: NuevaLinea) => Promise<void>
}) {
  if (detalle.tramites.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500">La cuenta no tiene trámites.</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3 font-semibold">Trámite</th>
            <th className="px-3 py-3 font-semibold">Detalle</th>
            <th className="px-3 py-3 font-semibold">Fecha</th>
            <th className="px-3 py-3 font-semibold">Centro de costos</th>
            <th className="px-3 py-3 text-right font-semibold">Valor</th>
            {detalle.editable && <th className="w-10 px-3 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {detalle.tramites.map(t => (
            <FilasTramite key={t.tramiteId} detalleId={detalle.id} tramite={t} editable={detalle.editable} ocupado={ocupado}
              agregando={agregandoA === t.tramiteId} onAgregar={onAgregar}
              onGuardarLinea={onGuardarLinea} onQuitarLinea={onQuitarLinea} onNuevaLinea={onNuevaLinea} />
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50">
            <td colSpan={4} className="px-3 py-3 text-right text-xs font-semibold text-slate-600">Total</td>
            <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-slate-800">{pesos(detalle.total)}</td>
            {detalle.editable && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function FilasTramite({ detalleId, tramite, editable, ocupado, agregando, onAgregar, onGuardarLinea, onQuitarLinea, onNuevaLinea }: {
  detalleId: number
  tramite: TramiteCuenta
  editable: boolean
  ocupado: boolean
  agregando: boolean
  onAgregar: (tramiteId: number | null) => void
  onGuardarLinea: (linea: LineaCuenta, cambios: Partial<{ valor: number, concepto: string, fecha: string }>) => Promise<boolean>
  onQuitarLinea: (linea: LineaCuenta) => void
  onNuevaLinea: (datos: NuevaLinea) => Promise<void>
}) {
  return (
    <>
      {tramite.lineas.map((linea, i) => (
        <tr key={linea.id} className={clsx(linea.tipo !== "TRAMITE" && "bg-slate-50/50")}>
          <td className="whitespace-nowrap px-3 py-2 align-top">
            {i === 0 ? (
              <>
                <a href={`/center/solicitudTramites/${tramite.tramiteId}`} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:underline">#{tramite.tramiteId}</a>
                <p className="text-[11px] text-slate-500">{tramite.placa ?? "—"}</p>
                {tramite.cliente && <p className="max-w-[10rem] truncate text-[11px] text-slate-400">{tramite.cliente}</p>}
              </>
            ) : null}
          </td>
          <td className="min-w-[12rem] px-3 py-2 align-top">
            {editable
              ? <CeldaTexto key={linea.concepto} valor={linea.concepto} onGuardar={concepto => onGuardarLinea(linea, { concepto })} />
              : <span className="text-slate-700">{linea.concepto}</span>}
            {linea.tipo !== "TRAMITE" && (
              <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">{NOMBRE_TIPO_LINEA[linea.tipo]}</span>
            )}
            {linea.creadaPorTramitador && (
              <p className="mt-0.5 text-[11px] text-indigo-600">
                Agregada por el tramitador
                {linea.tieneSoporte && (
                  <> · <a href={`/api/backend/cuentas-cobro-tramitadores/${detalleId}/lineas/${linea.id}/soporte`} target="_blank" rel="noreferrer" className="font-semibold underline">Ver soporte</a></>
                )}
              </p>
            )}
          </td>
          <td className="whitespace-nowrap px-3 py-2 align-top">
            {editable && linea.tipo !== "TRAMITE"
              ? <CeldaFecha key={linea.fecha} valor={linea.fecha} onGuardar={fecha => onGuardarLinea(linea, { fecha })} />
              : <span className="text-slate-600">{fechaCorta(linea.fecha)}</span>}
          </td>
          <td className="px-3 py-2 align-top text-[11px] text-slate-500">{linea.centroCostos ?? "—"}</td>
          <td className="px-3 py-2 text-right align-top">
            {editable
              ? <CeldaValor key={linea.valor} centavos={linea.valor} resaltar={linea.tipo === "TRAMITE" && !linea.valor} onGuardar={valor => onGuardarLinea(linea, { valor })} />
              : <span className="font-semibold tabular-nums text-slate-700">{pesos(linea.valor)}</span>}
          </td>
          {editable && (
            <td className="px-3 py-2 text-right align-top">
              <button type="button" disabled={ocupado} onClick={() => onQuitarLinea(linea)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                aria-label={linea.tipo === "TRAMITE" ? `Quitar el trámite #${tramite.tramiteId}` : "Quitar la línea"} title={linea.tipo === "TRAMITE" ? "Quitar el trámite" : "Quitar la línea"}>
                <Trash2 size={15} />
              </button>
            </td>
          )}
        </tr>
      ))}
      {editable && (
        <tr>
          <td colSpan={6} className="px-3 pb-3 pt-1">
            {agregando
              ? <FormularioLinea tramiteId={tramite.tramiteId} ocupado={ocupado} onCancelar={() => onAgregar(null)} onGuardar={onNuevaLinea} />
              : (
                <button type="button" onClick={() => onAgregar(tramite.tramiteId)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline">
                  <Plus size={13} /> Visita fallida o adicional
                </button>
              )}
          </td>
        </tr>
      )}
    </>
  )
}

// Celdas que guardan al salir del campo (solo si cambió)
function CeldaTexto({ valor, onGuardar }: { valor: string, onGuardar: (v: string) => Promise<boolean> }) {
  const [texto, setTexto] = useState(valor)
  return (
    <input value={texto} maxLength={200} onChange={e => setTexto(e.target.value)} className={claseCelda}
      onBlur={async () => { if (texto.trim() && texto.trim() !== valor && !(await onGuardar(texto.trim()))) setTexto(valor) }} />
  )
}

function CeldaFecha({ valor, onGuardar }: { valor: string, onGuardar: (v: string) => Promise<boolean> }) {
  const [fecha, setFecha] = useState(valor)
  return (
    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={clsx(claseCelda, "w-36")}
      onBlur={async () => { if (fecha && fecha !== valor && !(await onGuardar(fecha))) setFecha(valor) }} />
  )
}

function CeldaValor({ centavos, resaltar, onGuardar }: { centavos: number, resaltar: boolean, onGuardar: (pesos: number) => Promise<boolean> }) {
  const inicial = String(Math.round(centavos / 100))
  const [valor, setValor] = useState(inicial)
  return (
    <input inputMode="numeric" value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ""))}
      className={clsx(claseCelda, "w-28 text-right tabular-nums", resaltar && "border-amber-300 bg-amber-50")}
      aria-label="Valor en pesos"
      onBlur={async () => { if (valor !== inicial && !(await onGuardar(Number(valor || 0)))) setValor(inicial) }} />
  )
}

function FormularioLinea({ tramiteId, ocupado, onCancelar, onGuardar }: {
  tramiteId: number
  ocupado: boolean
  onCancelar: () => void
  onGuardar: (datos: NuevaLinea) => Promise<void>
}) {
  const [tipo, setTipo] = useState<NuevaLinea["tipo"]>("VISITA_FALLIDA")
  const [concepto, setConcepto] = useState("")
  const [fecha, setFecha] = useState("")
  const [valor, setValor] = useState("")
  const guardar = () => {
    if (!concepto.trim() || !fecha || !Number(valor)) return toast.error("Complete el concepto, la fecha y el valor")
    void onGuardar({ solicitudTramiteId: tramiteId, tipo, concepto: concepto.trim(), fecha, valor: Number(valor) })
  }
  return (
    <div className="grid gap-2 rounded-lg border border-sky-100 bg-sky-50/40 p-3 sm:grid-cols-[10rem_1fr_9rem_8rem_auto]">
      <select value={tipo} onChange={e => setTipo(e.target.value as NuevaLinea["tipo"])} className={claseInput} aria-label="Tipo">
        <option value="VISITA_FALLIDA">Visita fallida</option>
        <option value="ADICIONAL">Adicional</option>
      </select>
      <input value={concepto} onChange={e => setConcepto(e.target.value)} maxLength={200} className={claseInput}
        placeholder={tipo === "VISITA_FALLIDA" ? "Ej: Traspaso fallido" : "Ej: Papelería, sobres"} aria-label="Concepto" />
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} aria-label="Fecha" />
      <input inputMode="numeric" value={valor} onChange={e => setValor(e.target.value.replace(/\D/g, ""))} className={clsx(claseInput, "text-right")} placeholder="Valor" aria-label="Valor en pesos" />
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} disabled={ocupado} className={claseBotonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={ocupado} className={claseBotonPrimario}>Agregar</button>
      </div>
    </div>
  )
}

function Distribucion({ detalle }: { detalle: Detalle }) {
  if (detalle.distribucion.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-slate-700">Distribución por centro de costos</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Centro de costos</th>
              <th className="px-3 py-2.5 text-right font-semibold">%</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {detalle.distribucion.map(d => (
              <tr key={d.centroCostos}>
                <td className="px-3 py-2 text-slate-700">{d.centroCostos}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{String(d.porcentaje).replace(".", ",")} %</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-700">{pesos(d.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Historial({ detalle }: { detalle: Detalle }) {
  if (detalle.historial.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-slate-700">Historial</h3>
      <ol className="space-y-2 border-l border-slate-200 pl-4">
        {detalle.historial.map(h => (
          <li key={h.id} className="text-xs">
            <p className="text-slate-700">
              <span className="font-semibold">{h.accion}</span>
              <span className="text-slate-400"> · {fechaHora(h.fecha)} · </span>
              <span className={h.esTramitador ? "text-indigo-600" : "text-slate-500"}>{h.nombre}</span>
            </p>
            {h.detalle && <p className="mt-0.5 whitespace-pre-line text-slate-500">{h.detalle}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
