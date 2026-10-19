"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { FileText, Loader2, Plus, Search, UserPlus, X } from "lucide-react"
import { buscarTercerosGasto, crearGastoDesdeTramite, type TerceroGasto } from "@/actions/gastos-tramite-action"
import type { OpcionesGasto } from "@/src/gastos/datosGastos"
import { avisarGastoCreado } from "@/components/gastos/avisoProgramacion"

const claseInput = `
  w-full h-10 px-3 rounded-md border border-slate-200 bg-white
  text-xs text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-sky-400 focus:ring-2 focus:ring-sky-100
`
const claseLabel = "block mb-1.5 text-xs font-medium text-slate-600"

// Documentos opcionales del gasto nuevo (mismos límites del backend de Gastos)
type DocumentoPendiente = { tipoDocumentoId: number, archivo: File }
const TIPOS_ARCHIVO = ["application/pdf", "image/jpeg", "image/png"]
const MAX_MB = 15

// Sube los documentos al gasto recién creado (por el proxy, que lleva la sesión), por tipo y de a 10.
// Devuelve cuántos no se cargaron: el gasto ya quedó creado y se pueden subir desde Nodex Gastos
const subirDocumentosDelGasto = async (gastoId: number, documentos: DocumentoPendiente[]) => {
  let fallidos = 0
  for (const tipo of [...new Set(documentos.map(d => d.tipoDocumentoId))]) {
    const delTipo = documentos.filter(d => d.tipoDocumentoId === tipo)
    for (let i = 0; i < delTipo.length; i += 10) {
      const grupo = delTipo.slice(i, i + 10)
      const datos = new FormData()
      datos.append("tipoDocumentoId", String(tipo))
      grupo.forEach(d => datos.append("archivos", d.archivo))
      const respuesta = await fetch(`/api/backend/gastos/solicitudes/${gastoId}/documentos`, { method: "POST", body: datos }).catch(() => null)
      if (!respuesta?.ok) {
        fallidos += grupo.length
        const json = await respuesta?.json().catch(() => null)
        if (json?.error) toast.error(json.error)
      }
    }
  }
  return fallidos
}

const BENEFICIARIO_VACIO = { tipoIdentificacion: "NIT", identificacion: "", nombre: "", banco: "", tipoCuenta: "", numeroCuenta: "" }

export type TramiteParaGasto = {
  id: number
  operacionId: number | null
  placa: string | null
  matriculaInmobiliaria: string | null
}

function Campo({ etiqueta, obligatorio, children, className = "" }: {
  etiqueta: string
  obligatorio?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className={claseLabel}>{etiqueta} {obligatorio && <span className="text-red-400">*</span>}</span>
      {children}
    </label>
  )
}

// Botón + ventana para crear un gasto del trámite. El gasto queda en Nodex Gastos
// en estado Solicitado, listo para que Tesorería lo pague.
export default function CrearGastoTramite({ tramite, opciones }: { tramite: TramiteParaGasto, opciones: OpcionesGasto }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [guardando, startGuardar] = useTransition()

  // Tipo sugerido según lo que identifica al trámite
  const tipoSugerido = opciones.tiposGasto.find(t =>
    t.codigo === (tramite.placa ? "VEHICULO" : tramite.matriculaInmobiliaria ? "INMUEBLE" : "OTRO")
  )?.id ?? null

  const inicial = () => ({
    bolsaId: opciones.bolsas.length === 1 ? opciones.bolsas[0].id : null as number | null,
    tipoGastoId: tipoSugerido,
    formaPagoId: null as number | null,
    conceptoPago: "",
    valorSolicitado: "",
    // Retención (solo inmuebles): base por defecto 0 y porcentaje por defecto 11 %
    baseRetencion: "0",
    porcentajeRetencion: String(opciones.porcentajeRetencion),
    placa: tramite.placa ?? "",
    transito: "",
    matriculaInmobiliaria: tramite.matriculaInmobiliaria ?? "",
    reembolsable: true,
    observacion: ""
  })

  const [datos, setDatos] = useState(inicial)
  const [beneficiario, setBeneficiario] = useState<TerceroGasto | null>(null)
  const [nuevo, setNuevo] = useState<typeof BENEFICIARIO_VACIO | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<TerceroGasto[]>([])
  const [documentos, setDocumentos] = useState<DocumentoPendiente[]>([])
  const [tipoDocumentoId, setTipoDocumentoId] = useState(opciones.tiposDocumentoPago.length === 1 ? String(opciones.tiposDocumentoPago[0].id) : "")
  const [entradaArchivos, setEntradaArchivos] = useState(0) // reinicia el campo de archivos al agregarlos

  const agregarArchivos = (archivos: File[]) => {
    if (!tipoDocumentoId) return toast.error("Seleccione el tipo de documento")
    const validos = archivos.filter(archivo => {
      const error = !TIPOS_ARCHIVO.includes(archivo.type) ? `"${archivo.name}" no es PDF, JPG ni PNG`
        : archivo.size > MAX_MB * 1024 * 1024 ? `"${archivo.name}" pesa más de ${MAX_MB} MB`
          : null
      if (error) toast.error(error)
      return !error
    })
    setDocumentos(actuales => [...actuales, ...validos.map(archivo => ({ tipoDocumentoId: Number(tipoDocumentoId), archivo }))])
    setEntradaArchivos(n => n + 1)
  }

  const cambiar = <K extends keyof ReturnType<typeof inicial>>(campo: K, valor: ReturnType<typeof inicial>[K]) =>
    setDatos(actuales => ({ ...actuales, [campo]: valor }))

  const codigoTipo = opciones.tiposGasto.find(t => t.id === datos.tipoGastoId)?.codigo
  const llevaRetencion = codigoTipo === "INMUEBLE"

  // Vista previa de la retención (el cálculo definitivo lo hace el backend), en centavos
  const baseC = Math.round(Number(datos.baseRetencion || 0) * 100)
  const retencionC = Math.round(baseC * Number(datos.porcentajeRetencion || 0) / 100)
  const moneda = (centavos: number) =>
    (centavos / 100).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 })

  // Búsqueda de beneficiarios (espera a que se deje de escribir)
  useEffect(() => {
    if (busqueda.trim().length < 3) {
      setResultados([])
      return
    }
    const espera = setTimeout(async () => setResultados(await buscarTercerosGasto(busqueda)), 350)
    return () => clearTimeout(espera)
  }, [busqueda])

  const cerrar = () => {
    if (guardando) return
    setAbierto(false)
    setDatos(inicial())
    setBeneficiario(null)
    setNuevo(null)
    setBusqueda("")
    setDocumentos([])
  }

  const guardar = () => {
    if (!tramite.operacionId) return toast.error("El trámite no tiene operación asociada")
    if (!datos.bolsaId) return toast.error("Seleccione la bolsa")
    if (!datos.tipoGastoId) return toast.error("Seleccione el tipo de gasto")
    if (!datos.formaPagoId) return toast.error("Seleccione la forma de pago")
    if (!datos.conceptoPago.trim()) return toast.error("Escriba el concepto del pago")
    if (!(Number(datos.valorSolicitado) > 0)) return toast.error("El valor solicitado debe ser mayor a cero")
    if (!beneficiario && !(nuevo?.identificacion.trim() && nuevo?.nombre.trim())) {
      return toast.error("Seleccione o registre el beneficiario del pago")
    }
    if (llevaRetencion) {
      const porcentaje = Number(datos.porcentajeRetencion)
      if (datos.porcentajeRetencion === "" || !(porcentaje >= 0 && porcentaje <= 100)) {
        return toast.error("El porcentaje de retención debe estar entre 0 y 100")
      }
      if (baseC < 0) return toast.error("La base de retención no puede ser negativa")
    }

    startGuardar(async () => {
      const resultado = await crearGastoDesdeTramite({
        solicitudTramiteId: tramite.id,
        operacionId: tramite.operacionId!,
        bolsaId: datos.bolsaId!,
        tipoGastoId: datos.tipoGastoId!,
        formaPagoId: datos.formaPagoId!,
        conceptoPago: datos.conceptoPago,
        valorSolicitado: Number(datos.valorSolicitado),
        baseRetencion: llevaRetencion ? baseC / 100 : null,
        porcentajeRetencion: llevaRetencion ? Number(datos.porcentajeRetencion) : null,
        placa: datos.placa,
        transito: datos.transito,
        matriculaInmobiliaria: datos.matriculaInmobiliaria,
        reembolsable: datos.reembolsable,
        observacion: datos.observacion,
        beneficiarioId: beneficiario?.id ?? null,
        beneficiario: beneficiario ? null : nuevo
      })

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      if (resultado.datos.programacion?.siguienteDiaHabil) avisarGastoCreado(resultado.datos.codigo, resultado.datos.programacion)
      else toast.success(`Gasto ${resultado.datos.codigo} creado. Queda pendiente de pago en Tesorería.`)
      if (documentos.length) {
        const fallidos = await subirDocumentosDelGasto(resultado.datos.id, documentos)
        if (fallidos) toast.warning(`${fallidos} documento(s) no se cargaron: súbalos desde el gasto en Nodex Gastos`, { autoClose: 10000 })
        else toast.success(`${documentos.length} documento(s) cargado(s)`)
      }
      setDocumentos([])
      setAbierto(false)
      setDatos(inicial())
      setBeneficiario(null)
      setNuevo(null)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold shadow-sm transition hover:bg-sky-600"
      >
        <Plus size={15} />
        Crear gasto
      </button>

      <Dialog open={abierto} onClose={cerrar} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel className="w-full max-w-2xl rounded-xl bg-white shadow-xl">

              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <DialogTitle className="text-sm font-semibold text-slate-800">Nuevo gasto · Trámite {tramite.id}</DialogTitle>
                  <p className="mt-0.5 text-xs text-slate-400">Queda en Nodex Gastos para que Tesorería lo pague.</p>
                </div>
                <button type="button" onClick={cerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo etiqueta="Bolsa" obligatorio>
                    <select value={datos.bolsaId ?? ""} onChange={e => cambiar("bolsaId", e.target.value ? Number(e.target.value) : null)} className={claseInput}>
                      <option value="">{opciones.bolsas.length ? "Seleccione la bolsa" : "No hay bolsas activas"}</option>
                      {opciones.bolsas.map(b => <option key={b.id} value={b.id}>{b.lineaNegocio ? `${b.nombre} · ${b.lineaNegocio}` : b.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo etiqueta="Tipo de gasto" obligatorio>
                    <select value={datos.tipoGastoId ?? ""} onChange={e => cambiar("tipoGastoId", e.target.value ? Number(e.target.value) : null)} className={claseInput}>
                      <option value="">Seleccione</option>
                      {opciones.tiposGasto.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo etiqueta="Forma de pago" obligatorio>
                    <select value={datos.formaPagoId ?? ""} onChange={e => cambiar("formaPagoId", e.target.value ? Number(e.target.value) : null)} className={claseInput}>
                      <option value="">Seleccione</option>
                      {opciones.formasPago.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo etiqueta="Valor solicitado" obligatorio>
                    <input type="number" min={0} step="0.01" value={datos.valorSolicitado} onChange={e => cambiar("valorSolicitado", e.target.value)} placeholder="0" className={claseInput} />
                  </Campo>
                  <Campo etiqueta="Concepto del pago" obligatorio className="sm:col-span-2">
                    <input value={datos.conceptoPago} onChange={e => cambiar("conceptoPago", e.target.value)} maxLength={200} placeholder="Ej: Pago derechos de tránsito" className={claseInput} />
                  </Campo>

                  {codigoTipo === "VEHICULO" && (
                    <>
                      <Campo etiqueta="Placa" obligatorio>
                        <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={20} className={claseInput} />
                      </Campo>
                      <Campo etiqueta="Tránsito" obligatorio>
                        <input value={datos.transito} onChange={e => cambiar("transito", e.target.value)} maxLength={100} placeholder="Ej: Tránsito de Bogotá" className={claseInput} />
                      </Campo>
                    </>
                  )}
                  {codigoTipo === "INMUEBLE" && (
                    <>
                      <Campo etiqueta="Matrícula inmobiliaria" obligatorio>
                        <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
                      </Campo>
                      <div className="hidden sm:block" />
                      <Campo etiqueta="Base de retención">
                        <input type="number" min={0} step="0.01" value={datos.baseRetencion} onChange={e => cambiar("baseRetencion", e.target.value)} placeholder="0 si no aplica" className={claseInput} />
                      </Campo>
                      <Campo etiqueta="Porcentaje de retención (%)" obligatorio>
                        <input type="number" min={0} max={100} step="0.01" value={datos.porcentajeRetencion} onChange={e => cambiar("porcentajeRetencion", e.target.value)} className={claseInput} />
                      </Campo>
                      <p className="text-[11px] text-slate-500 sm:col-span-2">
                        Tesorería paga el valor solicitado sin deducción; la retención es informativa.
                      </p>
                      <div className="grid gap-x-6 gap-y-2 rounded-md bg-slate-50 px-4 py-3 text-xs sm:col-span-2 sm:grid-cols-2">
                        <p className="flex justify-between">
                          <span className="text-slate-500">Retención ({datos.porcentajeRetencion || 0} % de la base)</span>
                          <b>{moneda(retencionC)}</b>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-500">Total a pagar (base − retención)</span>
                          <b className="text-slate-800">{moneda(baseC - retencionC)}</b>
                        </p>
                      </div>
                    </>
                  )}
                  {/* CTL: de un vehículo o de un inmueble (opcionales). Lo paga Tesorería - Certificados */}
                  {codigoTipo === "CTL" && (
                    <>
                      <Campo etiqueta="Placa (si es de vehículo)">
                        <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={20} className={claseInput} />
                      </Campo>
                      <Campo etiqueta="Matrícula (si es de inmueble)">
                        <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
                      </Campo>
                    </>
                  )}
                </div>

                {/* Beneficiario */}
                <div>
                  <p className={claseLabel}>Beneficiario del pago <span className="text-red-400">*</span></p>

                  {beneficiario ? (
                    <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700">{beneficiario.nombre}</p>
                        <p className="text-slate-500">{beneficiario.tipoIdentificacion} {beneficiario.identificacion}{beneficiario.banco && ` · ${beneficiario.banco} ${beneficiario.numeroCuenta ?? ""}`}</p>
                      </div>
                      <button type="button" onClick={() => setBeneficiario(null)} className="font-medium text-sky-600 hover:underline">Cambiar</button>
                    </div>
                  ) : nuevo ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <select value={nuevo.tipoIdentificacion} onChange={e => setNuevo({ ...nuevo, tipoIdentificacion: e.target.value })} className={claseInput} aria-label="Tipo de identificación">
                          {["NIT", "CC", "CE", "PAS"].map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input value={nuevo.identificacion} onChange={e => setNuevo({ ...nuevo, identificacion: e.target.value })} placeholder="Identificación" maxLength={30} className={claseInput} />
                        <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre o razón social" maxLength={200} className={claseInput} />
                        <input value={nuevo.banco} onChange={e => setNuevo({ ...nuevo, banco: e.target.value })} placeholder="Banco (opcional)" maxLength={100} className={claseInput} />
                        <select value={nuevo.tipoCuenta} onChange={e => setNuevo({ ...nuevo, tipoCuenta: e.target.value })} className={claseInput} aria-label="Tipo de cuenta">
                          <option value="">Sin cuenta</option>
                          <option value="AHORROS">Ahorros</option>
                          <option value="CORRIENTE">Corriente</option>
                        </select>
                        <input value={nuevo.numeroCuenta} onChange={e => setNuevo({ ...nuevo, numeroCuenta: e.target.value })} placeholder="Número de cuenta" maxLength={30} className={claseInput} />
                      </div>
                      <button type="button" onClick={() => setNuevo(null)} className="text-xs font-medium text-slate-500 hover:underline">Volver a buscar</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por identificación o nombre (mínimo 3 caracteres)" className={`${claseInput} pl-9`} aria-label="Buscar beneficiario" />
                      </div>
                      {resultados.length > 0 && (
                        <ul className="max-h-48 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                          {resultados.map(t => (
                            <li key={t.id}>
                              <button type="button" onClick={() => setBeneficiario(t)} className="w-full px-3 py-2 text-left hover:bg-sky-50">
                                <p className="text-xs font-medium text-slate-700">{t.nombre}</p>
                                <p className="text-[11px] text-slate-400">{t.tipoIdentificacion} {t.identificacion}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => setNuevo({ ...BENEFICIARIO_VACIO, identificacion: /^\d/.test(busqueda.trim()) ? busqueda.trim() : "" })}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:underline"
                      >
                        <UserPlus size={14} />
                        Registrar un beneficiario nuevo
                      </button>
                    </div>
                  )}
                </div>

                {/* DOCUMENTOS (opcional): solo los tipos de pago */}
                {opciones.tiposDocumentoPago.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Documentos (opcional)</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <Campo etiqueta="Tipo de documento" className="min-w-[200px]">
                        <select value={tipoDocumentoId} onChange={e => setTipoDocumentoId(e.target.value)} className={claseInput}>
                          <option value="">Seleccione</option>
                          {opciones.tiposDocumentoPago.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                      </Campo>
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        <Plus size={15} /> Agregar archivos
                        <input
                          key={entradaArchivos}
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => agregarArchivos(Array.from(e.target.files ?? []))}
                          className="sr-only"
                        />
                      </label>
                      <span className="pb-2.5 text-[11px] text-slate-400">PDF, JPG o PNG · máx. {MAX_MB} MB c/u</span>
                    </div>
                    {documentos.length > 0 && (
                      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                        {documentos.map((d, i) => (
                          <li key={`${d.archivo.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                            <FileText size={15} className="shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 truncate text-slate-700">{d.archivo.name}</span>
                            <span className="shrink-0 text-slate-400">{opciones.tiposDocumentoPago.find(t => t.id === d.tipoDocumentoId)?.nombre}</span>
                            <button type="button" onClick={() => setDocumentos(documentos.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Quitar ${d.archivo.name}`}>
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo etiqueta="Observación" className="sm:col-span-2">
                    <textarea
                      value={datos.observacion}
                      onChange={e => cambiar("observacion", e.target.value)}
                      rows={2}
                      maxLength={2000}
                      className="w-full px-3 py-2.5 rounded-md border border-slate-200 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </Campo>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={datos.reembolsable} onChange={e => cambiar("reembolsable", e.target.checked)} className="h-4 w-4 accent-sky-500" />
                    Reembolsable (se le cobra al cliente)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button type="button" onClick={cerrar} disabled={guardando} className="h-10 px-4 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="button" onClick={guardar} disabled={guardando} className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-50">
                  {guardando && <Loader2 size={15} className="animate-spin" />}
                  Crear gasto
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  )
}
