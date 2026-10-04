"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import clsx from "clsx"
import { CheckCircle2, CircleAlert, FileText, Loader2, Trash2, UploadCloud } from "lucide-react"
import { registrarFactura } from "@/actions/gastos/legalizacion"
import { proponerGasto } from "@/src/lib/asignarArchivos"
import { formatoMoneda, formatoTamano } from "@/src/lib/formato"
import type { GastoListado } from "@/src/schemas/gastos"
import type { Tasas } from "./ModalFactura"
import { claseBotonPrimario, claseBotonSecundario } from "../ui/estilos"

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"]
const MAX_BYTES = 15 * 1024 * 1024

type Estado = "pendiente" | "subiendo" | "listo" | "error"

type Fila = {
  clave: string
  archivo: File
  gastoId: number | null
  // Se guarda el código: al registrarla, el gasto sale de la lista de pendientes
  codigoGasto: string | null
  propuesto: boolean          // el gasto lo propuso el sistema por el nombre del archivo
  numeroFactura: string
  valorFactura: string
  identificacionTercero: string
  nombreTercero: string
  estado: Estado
  mensaje: string | null
}

const centavos = (valor: string | number | null) => Math.round(Number(valor || 0) * 100)
const claseCelda = "h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"

// Vista previa del archivo (abre en otra pestaña)
function EnlaceArchivo({ archivo }: { archivo: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const enlace = URL.createObjectURL(archivo)
    setUrl(enlace)
    return () => URL.revokeObjectURL(enlace)
  }, [archivo])

  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 font-medium text-emerald-700 hover:underline" title={archivo.name}>
      <FileText size={14} className="shrink-0" />
      <span className="truncate">{archivo.name}</span>
    </a>
  )
}

// Varias facturas de distintos gastos en una sola pasada: se suben los archivos, el sistema propone
// el gasto de cada uno por su nombre, se digitan los valores y se registra todo. Si una factura viene
// en varios archivos, se asignan al mismo gasto: los valores van en la primera fila y el resto se adjunta.
export default function CargaMasivaFacturas({
  gastos,
  tasas,
  tipoDocumentoFacturaId
}: {
  gastos: GastoListado[]
  tasas: Tasas
  tipoDocumentoFacturaId: number | null
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const gastoPorId = useMemo(() => new Map(gastos.map(g => [g.id, g])), [gastos])

  // Datos de la factura que vienen por defecto al elegir el gasto
  const valoresDelGasto = (gastoId: number | null) => {
    const gasto = gastoId ? gastoPorId.get(gastoId) : undefined
    return {
      codigoGasto: gasto?.codigo ?? null,
      valorFactura: gasto?.valorRealmentePagado ? String(Number(gasto.valorRealmentePagado)) : "",
      identificacionTercero: gasto?.beneficiario.identificacion ?? "",
      nombreTercero: gasto?.beneficiario.nombre ?? ""
    }
  }

  const agregar = (lista: FileList | File[]) => {
    const nuevas: Fila[] = []
    for (const archivo of Array.from(lista)) {
      if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
        toast.error(`"${archivo.name}" no es válido: solo PDF, JPG o PNG`)
        continue
      }
      if (archivo.size > MAX_BYTES) {
        toast.error(`"${archivo.name}" pesa más de 15 MB`)
        continue
      }
      const gastoId = proponerGasto(archivo.name, gastos)
      nuevas.push({
        clave: `${archivo.name}-${archivo.size}-${Date.now()}-${Math.random()}`,
        archivo,
        gastoId,
        propuesto: gastoId !== null,
        numeroFactura: "",
        ...valoresDelGasto(gastoId),
        estado: "pendiente",
        mensaje: null
      })
    }
    setFilas(actuales => [...actuales, ...nuevas])
    const reconocidos = nuevas.filter(f => f.propuesto).length
    if (nuevas.length) toast.info(`${nuevas.length} archivo(s): ${reconocidos} asignado(s) por su nombre, ${nuevas.length - reconocidos} por asignar`)
  }

  const cambiar = (clave: string, cambios: Partial<Fila>) =>
    setFilas(actuales => actuales.map(f => (f.clave === clave ? { ...f, ...cambios } : f)))

  const cambiarGasto = (clave: string, gastoId: number | null) =>
    cambiar(clave, { gastoId, propuesto: false, ...valoresDelGasto(gastoId) })

  // La primera fila de cada gasto lleva los valores; las demás son páginas adicionales
  const principalDe = (fila: Fila) => filas.find(f => f.gastoId === fila.gastoId && f.estado !== "listo")
  const esAdicional = (fila: Fila) =>
    fila.estado !== "listo" && fila.gastoId !== null && principalDe(fila)?.clave !== fila.clave

  const pendientes = filas.filter(f => f.estado !== "listo")
  const sinAsignar = pendientes.filter(f => !f.gastoId).length

  const registrarTodo = async () => {
    // Agrupa por gasto: una factura por gasto con todos sus archivos
    const grupos = new Map<number, Fila[]>()
    for (const fila of pendientes) {
      if (!fila.gastoId) continue
      grupos.set(fila.gastoId, [...(grupos.get(fila.gastoId) ?? []), fila])
    }
    if (grupos.size === 0) return toast.error("Asigne cada archivo a su gasto")

    setProcesando(true)
    let correctas = 0

    for (const [gastoId, grupo] of grupos) {
      const principal = grupo[0]
      const claves = grupo.map(f => f.clave)
      const marcar = (estado: Estado, mensaje: string | null) =>
        setFilas(actuales => actuales.map(f => (claves.includes(f.clave) ? { ...f, estado, mensaje } : f)))

      const valor = centavos(principal.valorFactura)
      if (!(valor > 0)) { marcar("error", "Falta el valor de la factura"); continue }

      marcar("subiendo", null)

      let archivos: FormData | null = null
      if (tipoDocumentoFacturaId) {
        archivos = new FormData()
        archivos.append("tipoDocumentoId", String(tipoDocumentoFacturaId))
        grupo.forEach(f => archivos!.append("archivos", f.archivo))
      }

      try {
        const resultado = await registrarFactura(gastoId, {
          numeroFactura: principal.numeroFactura.trim(),
          tieneFacturaReal: true,
          identificacionTerceroReal: principal.identificacionTercero.trim(),
          nombreTerceroReal: principal.nombreTercero.trim(),
          valorFactura: valor / 100,
          observacion: "Registrada en carga masiva de facturas"
        }, archivos)

        if (!resultado.ok) {
          marcar("error", resultado.errores.join(" · "))
          continue
        }
        correctas++
        const { diferencia } = resultado.datos
        marcar("listo", [
          diferencia > 0 ? `Reintegro de ${formatoMoneda(diferencia)}` : "Registrada",
          resultado.advertencia
        ].filter(Boolean).join(" · "))
      } catch {
        marcar("error", "No se pudo registrar, intente de nuevo")
      }
    }

    setProcesando(false)
    if (correctas) {
      toast.success(`${correctas} factura(s) registrada(s)`)
      router.refresh()
    }
  }

  const soltar = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    if (!procesando) agregar(e.dataTransfer.files)
  }

  return (
    <div className="space-y-4">

      {/* ZONA PARA SOLTAR ARCHIVOS */}
      <div
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        onClick={() => !procesando && entrada.current?.click()}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
          arrastrando ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
        )}
      >
        <UploadCloud size={30} className="text-emerald-500" />
        <p className="mt-2 text-sm font-semibold text-slate-700">Arrastre aquí las facturas o haga clic para elegirlas</p>
        <p className="mt-1 text-xs text-slate-400">
          PDF, JPG o PNG. Si el nombre del archivo tiene el código del gasto, el N° de trámite, la placa o la matrícula, se asigna solo.
        </p>
        <input
          ref={entrada}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={e => { if (e.target.files) agregar(e.target.files); e.target.value = "" }}
        />
      </div>

      {filas.length > 0 && (
        <>
          {/* TABLA: una fila por archivo */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-semibold">Archivo</th>
                  <th className="px-3 py-3 font-semibold w-64">Gasto</th>
                  <th className="px-3 py-3 font-semibold w-28">N° factura</th>
                  <th className="px-3 py-3 font-semibold w-32">Valor factura *</th>
                  <th className="px-3 py-3 font-semibold w-28">4x1000</th>
                  <th className="px-3 py-3 font-semibold w-56">Tercero (NIT / nombre)</th>
                  <th className="px-3 py-3 font-semibold w-40">Resultado</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((fila, i) => {
                  const gasto = fila.gastoId ? gastoPorId.get(fila.gastoId) : undefined
                  const adicional = esAdicional(fila)
                  const bloqueada = procesando || fila.estado === "listo" || fila.estado === "subiendo"
                  const diferencia = gasto && !adicional && fila.valorFactura ? centavos(gasto.valorRealmentePagado) - centavos(fila.valorFactura) : 0
                  const gmf = Math.round(centavos(fila.valorFactura) * tasas.gmf) / 100

                  return (
                    <tr key={fila.clave} className={clsx("align-top", fila.estado === "listo" && "bg-emerald-50/50", fila.estado === "error" && "bg-red-50/50")}>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <EnlaceArchivo archivo={fila.archivo} />
                        <p className="mt-0.5 text-[11px] text-slate-400">{formatoTamano(fila.archivo.size)}</p>
                      </td>

                      <td className="px-3 py-2.5">
                        {fila.estado === "listo" ? (
                          <p className="font-semibold text-slate-700">{fila.codigoGasto}</p>
                        ) : (<>
                        <select
                          value={fila.gastoId ?? ""}
                          onChange={e => cambiarGasto(fila.clave, Number(e.target.value) || null)}
                          disabled={bloqueada}
                          className={clsx(claseCelda, !fila.gastoId && "border-amber-300 bg-amber-50")}
                        >
                          <option value="">Seleccione el gasto…</option>
                          {gastos.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.codigo} · {g.placa ?? g.matriculaInmobiliaria ?? g.conceptoPago} · {formatoMoneda(g.valorRealmentePagado)}
                            </option>
                          ))}
                        </select>
                        {gasto && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {fila.propuesto && <span className="mr-1 font-semibold text-emerald-600">Asignado por el nombre ·</span>}
                            {gasto.conceptoPago}{gasto.solicitudTramiteId ? ` · Trámite #${gasto.solicitudTramiteId}` : ""}
                          </p>
                        )}
                        </>)}
                      </td>

                      {adicional ? (
                        <td colSpan={4} className="px-3 py-2.5 text-[11px] text-slate-500">
                          Página adicional: se adjunta a la misma factura de la fila {filas.findIndex(f => f.clave === principalDe(fila)?.clave) + 1}.
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2.5">
                            <input value={fila.numeroFactura} onChange={e => cambiar(fila.clave, { numeroFactura: e.target.value })} maxLength={50} disabled={bloqueada} className={claseCelda} aria-label={`Número de factura fila ${i + 1}`} />
                          </td>
                          <td className="px-3 py-2.5">
                            <input type="number" min={0} step="0.01" value={fila.valorFactura} onChange={e => cambiar(fila.clave, { valorFactura: e.target.value })} disabled={bloqueada} className={claseCelda} aria-label={`Valor factura fila ${i + 1}`} />
                            {diferencia !== 0 && (
                              <p className={clsx("mt-1 text-[11px]", diferencia > 0 ? "text-amber-700" : "text-red-600")}>
                                {diferencia > 0 ? `Reintegro ${formatoMoneda(diferencia / 100)}` : "Supera lo pagado"}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {/* La retención se define al crear el gasto; aquí solo el 4x1000 */}
                            <p className="flex h-8 items-center text-slate-600">{formatoMoneda(gmf)}</p>
                          </td>
                          <td className="px-3 py-2.5 space-y-1">
                            <input value={fila.identificacionTercero} onChange={e => cambiar(fila.clave, { identificacionTercero: e.target.value })} maxLength={30} placeholder="NIT / cédula" disabled={bloqueada} className={claseCelda} aria-label={`Identificación del tercero fila ${i + 1}`} />
                            <input value={fila.nombreTercero} onChange={e => cambiar(fila.clave, { nombreTercero: e.target.value })} maxLength={200} placeholder="Nombre de quien factura" disabled={bloqueada} className={claseCelda} aria-label={`Nombre del tercero fila ${i + 1}`} />
                          </td>
                        </>
                      )}

                      <td className="px-3 py-2.5">
                        {fila.estado === "subiendo" && <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 size={13} className="animate-spin" /> Registrando…</span>}
                        {fila.estado === "listo" && <span className="inline-flex items-start gap-1 text-emerald-700"><CheckCircle2 size={14} className="mt-px shrink-0" /> {fila.mensaje}</span>}
                        {fila.estado === "error" && <span className="inline-flex items-start gap-1 text-red-600"><CircleAlert size={14} className="mt-px shrink-0" /> {fila.mensaje}</span>}
                        {fila.estado === "pendiente" && <span className="text-slate-400">{fila.gastoId ? "Lista para registrar" : "Falta el gasto"}</span>}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {fila.estado !== "listo" && (
                          <button type="button" onClick={() => setFilas(a => a.filter(f => f.clave !== fila.clave))} disabled={procesando} className="p-1.5 text-slate-400 hover:text-red-600" aria-label={`Quitar ${fila.archivo.name}`}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ACCIONES */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {pendientes.length} archivo(s) por registrar
              {sinAsignar > 0 && <> · <b className="text-amber-700">{sinAsignar} sin gasto</b> (no se registran)</>}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilas(a => a.filter(f => f.estado !== "listo"))}
                disabled={procesando || !filas.some(f => f.estado === "listo")}
                className={claseBotonSecundario}
              >
                Quitar las registradas
              </button>
              <button type="button" onClick={registrarTodo} disabled={procesando || pendientes.length === sinAsignar} className={claseBotonPrimario}>
                {procesando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {procesando ? "Registrando…" : "Registrar facturas"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
