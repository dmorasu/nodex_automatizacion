"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import clsx from "clsx"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import {
  AlertTriangle, CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, FileUp, Loader2, Plus, Receipt,
  RotateCcw, Save, ShieldCheck, Trash2, XCircle
} from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import {
  COLUMNAS_PEGADO, filaDeDatos, filaVacia, leerPegado, parecePlaca, paraEnviar,
  type Catalogos, type Comunes, type DatosCrudos, type Fila, type Gasto
} from "@/src/lib/cargueTramites"
import { BuscadorCliente, BuscadorMunicipio, claseCampo } from "./Buscadores"
import { claseBotonPrimario, claseBotonSecundario, claseInput } from "../ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"

const COMUNES_VACIOS: Comunes = {
  clienteId: null, clienteNombre: "", tramiteId: null, operacionId: null, entidadId: null, municipioId: null,
  fechaEntrega: "", documentosAportados: "No",
  gasto: { conceptoPago: "", bolsaId: null, formaPagoId: null, beneficiarioIdentificacion: "", beneficiarioNombre: "", transito: "", reembolsable: true }
}

const BORRADOR = "nodex-cargue-tramites"

type Validacion = {
  filas: { fila: number, errores: string[], avisos: string[], cliente: { id: number, nombre: string, identificacion: string | null } | null }[]
  conErrores: number
  conAvisos: number
  conGasto: number
}
type Creado = { fila: number, tramiteId: number, gastoId: number | null, gastoCodigo: string | null }

// Lista desplegable compacta para la tabla: vacío = usa el valor común
function Lista({ valor, opciones, comun, onCambiar, ancho = "w-36" }: {
  valor: number | null
  opciones: { id: number, nombre: string }[]
  comun: number | null
  onCambiar: (id: number | null) => void
  ancho?: string
}) {
  const nombreComun = opciones.find(o => o.id === comun)?.nombre
  return (
    <SelectBuscable
      value={valor ?? ""}
      onChange={e => onCambiar(e.target.value ? Number(e.target.value) : null)}
      className={clsx(claseCampo, ancho, !valor && "text-slate-400")}
    >
      <option value="">{nombreComun ? `Común: ${nombreComun}` : "Seleccione"}</option>
      {opciones.map(o => <option key={o.id} value={o.id} className="text-slate-700">{o.nombre}</option>)}
    </SelectBuscable>
  )
}

function Campo({ etiqueta, children, className }: { etiqueta: string, children: React.ReactNode, className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{etiqueta}</span>
      {children}
    </label>
  )
}

// Cargue masivo de trámites en pantalla. Se llenan las filas (a mano, pegando desde Excel o
// importando el archivo), se validan contra el servidor y se guardan todas juntas: los trámites
// y, en las filas marcadas, su gasto. Si una fila tiene error no se guarda ninguna.
export default function CargueEnPantalla() {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [comunes, setComunes] = useState<Comunes>(COMUNES_VACIOS)
  const [filas, setFilas] = useState<Fila[]>(() => [filaVacia()])
  const [validacion, setValidacion] = useState<Validacion | null>(null)
  const [validando, setValidando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [creados, setCreados] = useState<Creado[] | null>(null)
  const [pegando, setPegando] = useState(false)
  const [textoPegado, setTextoPegado] = useState("")
  const [importando, setImportando] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const listoParaBorrador = useRef(false)

  // Catálogos y borrador guardado en este navegador (por si se cierra la página)
  useEffect(() => {
    void llamarApi<Catalogos>("/solicitudTramites/cargue/catalogos").then(r => {
      if (r.ok) setCatalogos(r.datos)
      else toast.error(r.error)
    })
    try {
      const guardado = JSON.parse(localStorage.getItem(BORRADOR) ?? "null")
      if (guardado?.filas?.length) {
        setFilas(guardado.filas.map((f: Fila) => ({ ...f, resultado: null })))
        setComunes({ ...COMUNES_VACIOS, ...guardado.comunes, gasto: { ...COMUNES_VACIOS.gasto, ...guardado.comunes?.gasto } })
        toast.info("Se recuperó el cargue que tenía sin guardar")
      }
    } catch { /* sin borrador */ }
    listoParaBorrador.current = true
  }, [])

  useEffect(() => {
    if (!listoParaBorrador.current || creados) return
    try {
      const vacio = filas.length === 1 && !filas[0].identificador && !filas[0].detalle
      if (vacio) localStorage.removeItem(BORRADOR)
      else localStorage.setItem(BORRADOR, JSON.stringify({ filas, comunes }))
    } catch { /* sin almacenamiento */ }
  }, [filas, comunes, creados])

  // Cualquier cambio invalida la validación anterior
  const cambiarFila = (clave: string, cambios: Partial<Fila>) => {
    setFilas(actuales => actuales.map(f => (f.clave === clave ? { ...f, ...cambios, resultado: null } : f)))
    setValidacion(null)
  }
  const cambiarGasto = (clave: string, cambios: Partial<Gasto>) => {
    setFilas(actuales => actuales.map(f => (f.clave === clave ? { ...f, gasto: { ...f.gasto, ...cambios }, resultado: null } : f)))
    setValidacion(null)
  }
  const cambiarComunes = (cambios: Partial<Comunes>) => { setComunes(c => ({ ...c, ...cambios })); setValidacion(null) }
  const cambiarGastoComun = (cambios: Partial<Comunes["gasto"]>) => { setComunes(c => ({ ...c, gasto: { ...c.gasto, ...cambios } })); setValidacion(null) }

  const tipoGastoPara = (f: Fila) =>
    catalogos?.gastos?.tiposGasto.find(t => t.codigo === (f.tipoIdentificador === "placa" ? "VEHICULO" : "INMUEBLE"))?.id ?? null

  // Al pegar o importar se descartan las filas que siguen vacías (ej: la del comienzo)
  const agregarFilas = (nuevas: Fila[], quitarVacias = true) => {
    setFilas(actuales => {
      const utiles = quitarVacias ? actuales.filter(f => f.identificador || f.detalle || f.direccion) : actuales
      return [...utiles, ...nuevas]
    })
    setValidacion(null)
  }

  const aplicarPegado = () => {
    if (!catalogos) return
    const datos = leerPegado(textoPegado)
    if (!datos.length) return toast.error("No hay filas para pegar")
    agregarFilas(datos.map(d => filaDeDatos(d, catalogos)))
    toast.success(`${datos.length} fila(s) agregadas. Revise las que quedaron sin municipio o tipo de trámite y valide.`)
    setTextoPegado("")
    setPegando(false)
  }

  const importarExcel = async (archivoExcel: File) => {
    if (!catalogos) return
    setImportando(true)
    const formData = new FormData()
    formData.append("file", archivoExcel)
    try {
      const res = await fetch("/api/backend/solicitudTramites/cargue/leer-excel", { method: "POST", body: formData })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(json.error ?? "No se pudo leer el archivo")
      const datos = json.filas as DatosCrudos[]
      if (!datos.length) return toast.error("El archivo no tiene filas")
      agregarFilas(datos.map(d => filaDeDatos(d, catalogos)))
      toast.success(`${datos.length} fila(s) importadas del Excel. Revíselas y valide.`)
    } catch {
      toast.error("No hay conexión con el servidor")
    } finally {
      setImportando(false)
      if (archivo.current) archivo.current.value = ""
    }
  }

  const validar = async () => {
    setValidando(true)
    const r = await llamarApi<Validacion>("/solicitudTramites/cargue/validar", "POST", { filas: filas.map(f => paraEnviar(f, comunes)) })
    setValidando(false)
    if (!r.ok) return toast.error(r.error)
    aplicarValidacion(r.datos)
    if (r.datos.conErrores) toast.error(`${r.datos.conErrores} fila(s) con errores: corríjalas y valide de nuevo`)
    else toast.success(`Todo listo: ${filas.length} trámite(s)${r.datos.conGasto ? ` y ${r.datos.conGasto} gasto(s)` : ""} para guardar`)
  }

  // Muestra el resultado en cada fila y deja fijo el cliente que encontró el servidor
  const aplicarValidacion = (v: Validacion) => {
    setFilas(actuales => actuales.map((f, i) => {
      const r = v.filas[i]
      if (!r) return f
      const cliente = r.cliente && !f.clienteId && f.clienteTexto ? { clienteId: r.cliente.id, clienteNombre: r.cliente.nombre, clienteTexto: "" } : {}
      return { ...f, ...cliente, resultado: { errores: r.errores, avisos: r.avisos } }
    }))
    setValidacion(v)
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await fetch("/api/backend/solicitudTramites/cargue/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: filas.map(f => paraEnviar(f, comunes)) })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json.validacion) aplicarValidacion(json.validacion)
        return toast.error(json.error ?? "No se pudo guardar")
      }
      setCreados(json.creados)
      try { localStorage.removeItem(BORRADOR) } catch { /* */ }
      toast.success(`${json.creados.length} trámite(s) creados`)
    } catch {
      toast.error("No hay conexión con el servidor")
    } finally {
      setGuardando(false)
    }
  }

  const empezarDeNuevo = () => {
    setFilas([filaVacia()])
    setValidacion(null)
    setCreados(null)
  }

  const conGasto = filas.some(f => f.conGasto)
  const listo = validacion !== null && validacion.conErrores === 0 && filas.every(f => f.resultado)
  const resumen = useMemo(() => ({
    errores: filas.filter(f => f.resultado?.errores.length).length,
    avisos: filas.filter(f => f.resultado?.avisos.length).length
  }), [filas])

  if (!catalogos) {
    return <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Cargando catálogos…</p>
  }

  // ── Resultado del guardado ──
  if (creados) {
    const ids = creados.map(c => c.tramiteId)
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Se crearon {creados.length} trámite(s)</p>
              <p className="text-xs text-emerald-800">
                {creados.filter(c => c.gastoId).length ? `Con ${creados.filter(c => c.gastoId).length} gasto(s), que ya están en Nodex Gastos para pago. ` : ""}
                A cada trámite se le asignó el analista de su municipio.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/center/cargueDocumentos?tramites=${ids.join(",")}`} className={claseBotonPrimario}>
              <FileUp size={15} /> Subir documentos de estos trámites
            </Link>
            <button type="button" onClick={empezarDeNuevo} className={claseBotonSecundario}>
              <RotateCcw size={15} /> Nuevo cargue
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5">Fila</th><th className="px-4 py-2.5">Trámite</th><th className="px-4 py-2.5">Placa / matrícula</th><th className="px-4 py-2.5">Gasto</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creados.map(c => (
                <tr key={c.tramiteId}>
                  <td className="px-4 py-2.5 text-slate-400">{c.fila}</td>
                  <td className="px-4 py-2.5"><Link href={`/center/solicitudTramites/${c.tramiteId}`} className="font-semibold text-sky-700 hover:underline">#{c.tramiteId}</Link></td>
                  <td className="px-4 py-2.5 text-slate-600">{filas[c.fila - 1]?.identificador}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.gastoCodigo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const g = catalogos.gastos

  return (
    <div className="space-y-5">

      {/* ── Valores comunes ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Valores comunes</h2>
        <p className="mt-0.5 text-xs text-slate-400">Aplican a todas las filas que no los cambien. Así solo digita lo que varía en cada trámite.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Cliente">
            <BuscadorCliente valor={{ id: comunes.clienteId, nombre: comunes.clienteNombre }} onElegir={c => cambiarComunes({ clienteId: c?.id ?? null, clienteNombre: c?.nombre ?? "" })} />
          </Campo>
          <Campo etiqueta="Tipo de trámite">
            <SelectBuscable value={comunes.tramiteId ?? ""} onChange={e => cambiarComunes({ tramiteId: Number(e.target.value) || null })} className={claseCampo}>
              <option value="">Seleccione</option>
              {catalogos.tramites.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </SelectBuscable>
          </Campo>
          <Campo etiqueta="Operación">
            <SelectBuscable value={comunes.operacionId ?? ""} onChange={e => cambiarComunes({ operacionId: Number(e.target.value) || null })} className={claseCampo}>
              <option value="">Seleccione</option>
              {catalogos.operaciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </SelectBuscable>
          </Campo>
          <Campo etiqueta="Entidad">
            <SelectBuscable value={comunes.entidadId ?? ""} onChange={e => cambiarComunes({ entidadId: Number(e.target.value) || null })} className={claseCampo}>
              <option value="">Seleccione</option>
              {catalogos.entidades.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </SelectBuscable>
          </Campo>
          <Campo etiqueta="Municipio">
            <BuscadorMunicipio municipios={catalogos.municipios} valor={comunes.municipioId} onElegir={id => cambiarComunes({ municipioId: id })} />
          </Campo>
          <Campo etiqueta="Fecha de entrega del resultado">
            <input type="date" value={comunes.fechaEntrega} onChange={e => cambiarComunes({ fechaEntrega: e.target.value })} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Documentos aportados">
            <SelectBuscable value={comunes.documentosAportados} onChange={e => cambiarComunes({ documentosAportados: e.target.value })} className={claseCampo}>
              <option value="No">No</option>
              <option value="Si">Sí</option>
            </SelectBuscable>
          </Campo>
        </div>

        {conGasto && g && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Receipt size={14} className="text-sky-500" /> Para los gastos</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Bolsa">
                <SelectBuscable value={comunes.gasto.bolsaId ?? ""} onChange={e => cambiarGastoComun({ bolsaId: Number(e.target.value) || null })} className={claseCampo}>
                  <option value="">Seleccione</option>
                  {g.bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </SelectBuscable>
              </Campo>
              <Campo etiqueta="Forma de pago">
                <SelectBuscable value={comunes.gasto.formaPagoId ?? ""} onChange={e => cambiarGastoComun({ formaPagoId: Number(e.target.value) || null })} className={claseCampo}>
                  <option value="">Seleccione</option>
                  {g.formasPago.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </SelectBuscable>
              </Campo>
              <Campo etiqueta="Concepto del pago">
                <input value={comunes.gasto.conceptoPago} onChange={e => cambiarGastoComun({ conceptoPago: e.target.value })} maxLength={200} placeholder="Ej: Pago derechos de tránsito" className={claseCampo} />
              </Campo>
              <Campo etiqueta="Reembolsable (se le cobra al cliente)">
                <SelectBuscable value={comunes.gasto.reembolsable ? "si" : "no"} onChange={e => cambiarGastoComun({ reembolsable: e.target.value === "si" })} className={claseCampo}>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </SelectBuscable>
              </Campo>
              <Campo etiqueta="Beneficiario: identificación">
                <input value={comunes.gasto.beneficiarioIdentificacion} onChange={e => cambiarGastoComun({ beneficiarioIdentificacion: e.target.value })} maxLength={30} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Beneficiario: nombre (solo si es nuevo)">
                <input value={comunes.gasto.beneficiarioNombre} onChange={e => cambiarGastoComun({ beneficiarioNombre: e.target.value })} maxLength={200} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Tránsito (vehículos)">
                <input value={comunes.gasto.transito} onChange={e => cambiarGastoComun({ transito: e.target.value })} maxLength={100} placeholder="Ej: Tránsito de Bogotá" className={claseCampo} />
              </Campo>
            </div>
          </div>
        )}
      </section>

      {/* ── Acciones ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => agregarFilas([filaVacia()], false)} className={claseBotonSecundario}>
          <Plus size={15} /> Agregar fila
        </button>
        <button type="button" onClick={() => setPegando(true)} className={claseBotonSecundario}>
          <ClipboardPaste size={15} /> Pegar desde Excel
        </button>
        <button type="button" onClick={() => archivo.current?.click()} disabled={importando} className={claseBotonSecundario}>
          {importando ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Importar Excel
        </button>
        <input ref={archivo} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && importarExcel(e.target.files[0])} />
        <a href="/api/backend/solicitudTramites/cargue/plantilla" className="inline-flex h-10 items-center gap-1.5 px-2 text-xs font-medium text-sky-700 hover:underline">
          <Download size={14} /> Plantilla de Excel
        </a>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={validar} disabled={validando || guardando} className={claseBotonSecundario}>
            {validando ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Validar
          </button>
          <button type="button" onClick={guardar} disabled={!listo || guardando} className={claseBotonPrimario} title={listo ? undefined : "Valide primero (sin errores)"}>
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar {filas.length} trámite(s)
          </button>
        </div>
      </div>

      {/* ── Resumen de la validación ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-slate-500">{filas.length} fila(s){conGasto ? ` · ${filas.filter(f => f.conGasto).length} con gasto` : ""}</span>
        {validacion && (
          resumen.errores
            ? <span className="inline-flex items-center gap-1 font-semibold text-red-600"><XCircle size={14} /> {resumen.errores} con errores</span>
            : <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 size={14} /> Sin errores: puede guardar</span>
        )}
        {validacion && resumen.avisos > 0 && <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><AlertTriangle size={14} /> {resumen.avisos} con avisos (revíselos; no impiden guardar)</span>}
        {!validacion && filas.some(f => f.identificador || f.detalle) && <span className="text-slate-400">Sin validar</span>}
      </div>

      {/* ── Filas ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2.5 text-center">#</th>
              <th className="px-2 py-2.5">Placa / matrícula</th>
              <th className="px-2 py-2.5">Detalle</th>
              <th className="px-2 py-2.5">Dirección</th>
              <th className="px-2 py-2.5">Municipio</th>
              <th className="px-2 py-2.5">Tipo de trámite</th>
              <th className="px-2 py-2.5">Cliente</th>
              <th className="px-2 py-2.5">Fecha entrega</th>
              <th className="px-2 py-2.5">Operación</th>
              <th className="px-2 py-2.5">Entidad</th>
              <th className="px-2 py-2.5 text-center">Gasto</th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const errores = f.resultado?.errores ?? []
              const avisos = f.resultado?.avisos ?? []
              return (
                <FilaTabla key={f.clave}>
                  <tr className={clsx("align-top", errores.length ? "bg-red-50/40" : f.resultado ? "bg-emerald-50/30" : "")}>
                    <td className="px-2 py-2 text-center">
                      {errores.length ? <XCircle size={15} className="mx-auto text-red-500" />
                        : f.resultado ? (avisos.length ? <AlertTriangle size={15} className="mx-auto text-amber-500" /> : <CheckCircle2 size={15} className="mx-auto text-emerald-500" />)
                          : <span className="text-slate-400">{i + 1}</span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex w-44 gap-1">
                        <SelectBuscable
                          value={f.tipoIdentificador}
                          onChange={e => cambiarFila(f.clave, { tipoIdentificador: e.target.value as Fila["tipoIdentificador"] })}
                          className={clsx(claseCampo, "w-[4.5rem] shrink-0 px-1")}
                          aria-label="Placa o matrícula"
                        >
                          <option value="placa">Placa</option>
                          <option value="matricula">Matr.</option>
                        </SelectBuscable>
                        <input
                          value={f.identificador}
                          onChange={e => {
                            const v = e.target.value
                            // Si lo escrito tiene forma de placa (ABC123) se marca como placa
                            cambiarFila(f.clave, { identificador: f.tipoIdentificador === "placa" ? v.toUpperCase() : v, tipoIdentificador: parecePlaca(v) ? "placa" : f.tipoIdentificador })
                          }}
                          maxLength={50}
                          className={claseCampo}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2"><input value={f.detalle} onChange={e => cambiarFila(f.clave, { detalle: e.target.value })} maxLength={200} className={clsx(claseCampo, "w-52")} /></td>
                    <td className="px-2 py-2"><input value={f.direccion} onChange={e => cambiarFila(f.clave, { direccion: e.target.value })} maxLength={100} className={clsx(claseCampo, "w-48")} /></td>
                    <td className="px-2 py-2">
                      <div className="w-44">
                        <BuscadorMunicipio
                          municipios={catalogos.municipios}
                          valor={f.municipioId}
                          placeholder={f.municipioTexto ? `¿${f.municipioTexto}?` : comunes.municipioId ? `Común: ${catalogos.municipios.find(m => m.id === comunes.municipioId)?.nombre}` : "Municipio"}
                          onElegir={id => cambiarFila(f.clave, { municipioId: id, municipioTexto: "" })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2"><Lista valor={f.tramiteId} opciones={catalogos.tramites} comun={comunes.tramiteId} onCambiar={id => cambiarFila(f.clave, { tramiteId: id })} ancho="w-40" /></td>
                    <td className="px-2 py-2">
                      <div className="w-44">
                        <BuscadorCliente
                          valor={{ id: f.clienteId, nombre: f.clienteNombre }}
                          placeholder={f.clienteTexto ? `¿${f.clienteTexto}?` : comunes.clienteNombre ? `Común: ${comunes.clienteNombre}` : "Buscar cliente"}
                          onElegir={c => cambiarFila(f.clave, { clienteId: c?.id ?? null, clienteNombre: c?.nombre ?? "", clienteTexto: "" })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={f.fechaEntrega}
                        onChange={e => cambiarFila(f.clave, { fechaEntrega: e.target.value })}
                        className={clsx(claseCampo, "w-32", !f.fechaEntrega && "text-slate-400")}
                        title={!f.fechaEntrega && comunes.fechaEntrega ? `Común: ${comunes.fechaEntrega}` : undefined}
                      />
                    </td>
                    <td className="px-2 py-2"><Lista valor={f.operacionId} opciones={catalogos.operaciones} comun={comunes.operacionId} onCambiar={id => cambiarFila(f.clave, { operacionId: id })} /></td>
                    <td className="px-2 py-2"><Lista valor={f.entidadId} opciones={catalogos.entidades} comun={comunes.entidadId} onCambiar={id => cambiarFila(f.clave, { entidadId: id })} /></td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={f.conGasto}
                        disabled={!g}
                        onChange={e => cambiarFila(f.clave, { conGasto: e.target.checked, gasto: e.target.checked && !f.gasto.tipoGastoId ? { ...f.gasto, tipoGastoId: tipoGastoPara(f) } : f.gasto })}
                        className="mt-2 h-4 w-4 accent-sky-600"
                        aria-label={`Fila ${i + 1} con gasto`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => { setFilas(a => (a.length === 1 ? [filaVacia()] : a.filter(x => x.clave !== f.clave))); setValidacion(null) }}
                        className="mt-1 p-1 text-slate-300 hover:text-red-500"
                        aria-label={`Quitar fila ${i + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>

                  {/* Gasto de la fila */}
                  {f.conGasto && g && (
                    <tr className="bg-sky-50/40">
                      <td />
                      <td colSpan={11} className="px-2 pb-3 pt-1">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="flex h-8 items-center gap-1 text-[11px] font-semibold text-sky-700"><Receipt size={13} /> Gasto</span>
                          <Campo etiqueta="Tipo de gasto">
                            <SelectBuscable value={f.gasto.tipoGastoId ?? ""} onChange={e => cambiarGasto(f.clave, { tipoGastoId: Number(e.target.value) || null })} className={clsx(claseCampo, "w-36")}>
                              <option value="">Seleccione</option>
                              {g.tiposGasto.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                            </SelectBuscable>
                          </Campo>
                          <Campo etiqueta="Valor">
                            <input inputMode="numeric" value={f.gasto.valor} onChange={e => cambiarGasto(f.clave, { valor: e.target.value.replace(/[^\d]/g, "") })} placeholder="0" className={clsx(claseCampo, "w-28")} />
                          </Campo>
                          <Campo etiqueta="Concepto">
                            <input value={f.gasto.conceptoPago} onChange={e => cambiarGasto(f.clave, { conceptoPago: e.target.value })} placeholder={comunes.gasto.conceptoPago ? `Común: ${comunes.gasto.conceptoPago}` : "Concepto del pago"} maxLength={200} className={clsx(claseCampo, "w-56")} />
                          </Campo>
                          <Campo etiqueta="Beneficiario (identificación)">
                            <input value={f.gasto.beneficiarioIdentificacion} onChange={e => cambiarGasto(f.clave, { beneficiarioIdentificacion: e.target.value })} placeholder={comunes.gasto.beneficiarioIdentificacion ? `Común: ${comunes.gasto.beneficiarioIdentificacion}` : ""} maxLength={30} className={clsx(claseCampo, "w-36")} />
                          </Campo>
                          {f.gasto.beneficiarioIdentificacion && (
                            <Campo etiqueta="Nombre (si es nuevo)">
                              <input value={f.gasto.beneficiarioNombre} onChange={e => cambiarGasto(f.clave, { beneficiarioNombre: e.target.value })} maxLength={200} className={clsx(claseCampo, "w-44")} />
                            </Campo>
                          )}
                          {f.tipoIdentificador === "placa" && (
                            <Campo etiqueta="Tránsito">
                              <input value={f.gasto.transito} onChange={e => cambiarGasto(f.clave, { transito: e.target.value })} placeholder={comunes.gasto.transito ? `Común: ${comunes.gasto.transito}` : ""} maxLength={100} className={clsx(claseCampo, "w-40")} />
                            </Campo>
                          )}
                          <Campo etiqueta="Bolsa">
                            <Lista valor={f.gasto.bolsaId} opciones={g.bolsas} comun={comunes.gasto.bolsaId} onCambiar={id => cambiarGasto(f.clave, { bolsaId: id })} />
                          </Campo>
                          <Campo etiqueta="Forma de pago">
                            <Lista valor={f.gasto.formaPagoId} opciones={g.formasPago} comun={comunes.gasto.formaPagoId} onCambiar={id => cambiarGasto(f.clave, { formaPagoId: id })} />
                          </Campo>
                          <Campo etiqueta="Reembolsable">
                            <SelectBuscable
                              value={f.gasto.reembolsable === null ? "" : f.gasto.reembolsable ? "si" : "no"}
                              onChange={e => cambiarGasto(f.clave, { reembolsable: e.target.value === "" ? null : e.target.value === "si" })}
                              className={clsx(claseCampo, "w-28", f.gasto.reembolsable === null && "text-slate-400")}
                            >
                              <option value="">Común: {comunes.gasto.reembolsable ? "Sí" : "No"}</option>
                              <option value="si">Sí</option>
                              <option value="no">No</option>
                            </SelectBuscable>
                          </Campo>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Errores y avisos de la fila */}
                  {(errores.length > 0 || avisos.length > 0) && (
                    <tr className={errores.length ? "bg-red-50/40" : "bg-amber-50/40"}>
                      <td />
                      <td colSpan={11} className="px-2 pb-2.5 text-[11px]">
                        {errores.map(e => <p key={e} className="flex items-center gap-1 text-red-600"><XCircle size={11} /> {e}</p>)}
                        {avisos.map(a => <p key={a} className="flex items-center gap-1 text-amber-700"><AlertTriangle size={11} /> {a}</p>)}
                      </td>
                    </tr>
                  )}
                </FilaTabla>
              )
            })}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => agregarFilas([filaVacia()], false)} className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:underline">
        <Plus size={14} /> Agregar otra fila
      </button>

      {/* ── Pegar desde Excel ── */}
      <Dialog open={pegando} onClose={() => setPegando(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Pegar filas desde Excel</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">
              Copie las celdas en Excel (con o sin encabezado) y péguelas aquí. Columnas, en este orden (las que falten toman el valor común):
            </p>
            <ol className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {COLUMNAS_PEGADO.map((c, i) => <li key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{i + 1}. {c}</li>)}
            </ol>
            <textarea
              value={textoPegado}
              onChange={e => setTextoPegado(e.target.value)}
              rows={10}
              placeholder={"ABC123\tLevantar prenda\tCalle 10 # 20-30\tMedellín\tLevantamiento de prenda\t900123456\t30/10/2026"}
              className={clsx(claseInput, "mt-3 h-auto py-2 font-mono")}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setPegando(false)} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={aplicarPegado} disabled={!textoPegado.trim()} className={claseBotonPrimario}>
                <ClipboardPaste size={15} /> Agregar filas
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  )
}

// Agrupa la fila con su gasto y sus mensajes (un fragmento con clave)
function FilaTabla({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

