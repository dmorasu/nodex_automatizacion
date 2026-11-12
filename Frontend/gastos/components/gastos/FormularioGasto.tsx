"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { AlertTriangle, HandCoins, Link2, X, Save, Loader2 } from "lucide-react"
import { consultarTramite, guardarGasto, subirDocumentos } from "@/actions/gastos/gastos"
import type {
  BolsaApoyo,
  Catalogos,
  DatosGasto,
  GastoDetalle,
  Operacion,
  Tercero,
  TramiteApoyo,
  Tramitador
} from "@/src/schemas/gastos"
import { formatoMoneda } from "@/src/lib/formato"
import BuscadorBeneficiario from "./BuscadorBeneficiario"
import DocumentosNuevoGasto, { type DocumentoPendiente } from "./DocumentosNuevoGasto"
import { avisarGastoCreado } from "./avisoProgramacion"
import Seccion from "../ui/Seccion"
import {
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseLabel,
  claseTextarea
} from "../ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"


// Sube los documentos del gasto recién creado, por tipo y de a 10 (límite del backend).
// Si alguno falla el gasto ya quedó creado: se avisa para subirlos desde el detalle
const subirDocumentosDelGasto = async (gastoId: number, documentos: DocumentoPendiente[]) => {
  const grupos: DocumentoPendiente[][] = []
  for (const tipo of [...new Set(documentos.map(d => d.tipoDocumentoId))]) {
    const delTipo = documentos.filter(d => d.tipoDocumentoId === tipo)
    for (let i = 0; i < delTipo.length; i += 10) grupos.push(delTipo.slice(i, i + 10))
  }

  let fallidos = 0
  for (const grupo of grupos) {
    const datos = new FormData()
    datos.append("tipoDocumentoId", String(grupo[0].tipoDocumentoId))
    grupo.forEach(d => datos.append("archivos", d.archivo))
    const resultado = await subirDocumentos(gastoId, datos)
    if (!resultado.ok) {
      fallidos += grupo.length
      resultado.errores.forEach(error => toast.error(error))
    }
  }

  if (fallidos) toast.warning(`El gasto se creó, pero ${fallidos} documento(s) no se cargaron: súbalos desde el detalle del gasto`, { autoClose: 10000 })
  else toast.success(`${documentos.length} documento(s) cargado(s)`)
}


// =====================================
// ESTADO INICIAL
// =====================================

// Gasto creado desde el anticipo de un cliente: se paga de la bolsa del anticipo, no es
// reembolsable y se descuenta del saldo del cliente. `disponible` = lo que le queda sin este gasto
export type AnticipoDelGasto = {
  id: number
  codigo: string
  tipo: string
  concepto: string
  placa: string | null
  matriculaInmobiliaria: string | null
  operacionId: number
  bolsa: { id: number, nombre: string }
  cliente: { nombre: string, identificacion: string }
  disponible: number
}

const BENEFICIARIO_VACIO = {
  tipoIdentificacion: "NIT",
  identificacion: "",
  nombre: "",
  banco: "",
  tipoCuenta: "",
  numeroCuenta: "",
  correo: ""
}

// "0.110000" → "11"
const aPorcentaje = (fraccion: string) => String(Math.round(Number(fraccion) * 1e6) / 1e4)

const centavos = (valor: string | null) => Math.round(Number(valor || 0) * 100)

// Gasto nuevo desde un anticipo: se precarga con sus datos (el valor, con lo que le queda al cliente)
const desdeAnticipo = (anticipo: AnticipoDelGasto, catalogos: Catalogos): Partial<DatosGasto> => ({
  anticipoId: anticipo.id,
  operacionId: anticipo.operacionId,
  bolsaId: anticipo.bolsa.id,
  tipoGastoId: catalogos.tiposGasto.find(t => t.codigo === anticipo.tipo)?.id ?? null,
  reembolsable: false,
  conceptoPago: anticipo.concepto,
  placa: anticipo.placa ?? "",
  matriculaInmobiliaria: anticipo.matriculaInmobiliaria ?? "",
  nombreClienteBanco: anticipo.cliente.nombre,
  identificacionClienteBanco: anticipo.cliente.identificacion,
  valorSolicitado: anticipo.disponible > 0 ? String(anticipo.disponible) : ""
})

const datosIniciales = (porcentajeRetencion: number, gasto?: GastoDetalle): DatosGasto => ({
  operacionId: gasto?.operacionId ?? null,
  bolsaId: gasto?.bolsaId ?? null,
  solicitudTramiteId: gasto?.solicitudTramiteId ?? null,
  tramitadorId: gasto?.tramitadorId ?? null,
  tipoGastoId: gasto?.tipoGastoId ?? null,
  formaPagoId: gasto?.formaPagoId ?? null,
  // Por defecto reembolsable (se le cobra al cliente)
  reembolsable: gasto?.reembolsable ?? true,
  numeroFactura: gasto?.numeroFactura ?? "",
  conceptoPago: gasto?.conceptoPago ?? "",
  matriculaInmobiliaria: gasto?.matriculaInmobiliaria ?? "",
  placa: gasto?.placa ?? "",
  transito: gasto?.transito ?? "",
  contrato: gasto?.contrato ?? "",
  nombreClienteBanco: gasto?.nombreClienteBanco ?? "",
  identificacionClienteBanco: gasto?.identificacionClienteBanco ?? "",
  codigoBpr: gasto?.codigoBpr ?? "",
  valorSolicitado: gasto?.valorSolicitadoPago ? String(Number(gasto.valorSolicitadoPago)) : "",
  // Retención (solo inmuebles): base por defecto 0 y porcentaje por defecto el parámetro (11 %)
  valorLiquidacion: gasto?.valorLiquidacion ? String(Number(gasto.valorLiquidacion)) : "",
  baseRetencion: gasto?.retencionBase ? String(Number(gasto.retencionBase)) : "0",
  porcentajeRetencion: gasto?.retencionPorcentaje ? aPorcentaje(gasto.retencionPorcentaje) : String(porcentajeRetencion),
  observacion: gasto?.observacion ?? "",
  beneficiarioId: gasto?.beneficiarioId ?? null,
  beneficiario: null
})


// =====================================
// COMPONENTES PEQUEÑOS
// =====================================

function Campo({ etiqueta, obligatorio, children, className }: {
  etiqueta: string
  obligatorio?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={claseLabel}>
        {etiqueta} {obligatorio && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  )
}

function Selector({ valor, opciones, onChange, vacio = "Seleccione una opción" }: {
  valor: number | null
  opciones: { id: number, nombre: string }[]
  onChange: (id: number | null) => void
  vacio?: string
}) {
  return (
    <SelectBuscable
      value={valor ?? ""}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      className={claseInput}
    >
      <option value="">{vacio}</option>
      {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </SelectBuscable>
  )
}


// Cálculo completo, paso a paso, para que quien crea el gasto vea de dónde sale el valor (pedido
// del usuario: no todas las analistas manejan la retención)
function CalculoRetencion({ liquidacionC, baseC, porcentaje, retencionC, solicitadoC }: {
  liquidacionC: number
  baseC: number
  porcentaje: string
  retencionC: number
  solicitadoC: number
}) {
  const conLiquidacion = liquidacionC > 0
  const resultadoC = (conLiquidacion ? liquidacionC : baseC) - retencionC
  const fila = (etiqueta: string, valor: string, clase = "") => (
    <p className={`flex justify-between gap-4 ${clase}`}>
      <span className="text-slate-500">{etiqueta}</span>
      <b className="tabular-nums">{valor}</b>
    </p>
  )

  return (
    <div className="mt-4 max-w-md space-y-1.5 rounded-md bg-slate-50 px-4 py-3 text-xs">
      {conLiquidacion && fila("Valor liquidación", formatoMoneda(liquidacionC / 100))}
      {fila("Base de retención", formatoMoneda(baseC / 100))}
      {fila(`Retención (${porcentaje} % × ${formatoMoneda(baseC / 100)})`, `− ${formatoMoneda(retencionC / 100)}`)}
      <div className="border-t border-slate-200 pt-1.5">
        {fila(conLiquidacion ? "Valor a solicitar (liquidación − retención)" : "Total a pagar (base − retención)", formatoMoneda(resultadoC / 100), "text-sm text-slate-800")}
      </div>
      {conLiquidacion && solicitadoC > 0 && solicitadoC !== resultadoC &&
        fila("Valor solicitado escrito", formatoMoneda(solicitadoC / 100), "text-amber-700")}
    </div>
  )
}


// =====================================
// FORMULARIO
// =====================================

export default function FormularioGasto({
  catalogos,
  operaciones,
  tramitadores,
  bolsas,
  porcentajeRetencion,
  gasto,
  anticipo,
  cajas = [],
  tiposTramite = [],
  edicionAdmin = false
}: {
  catalogos: Catalogos
  operaciones: Operacion[]
  tramitadores: Tramitador[]
  bolsas: BolsaApoyo[]
  porcentajeRetencion: number
  gasto?: GastoDetalle
  anticipo?: AnticipoDelGasto
  // Cajas menores activas (Bogotá, Medellín…): con forma de pago Caja menor se elige una
  cajas?: BolsaApoyo[]
  // Gastos de vehículo: el concepto sugiere los tipos de trámite (y acepta cualquier texto)
  tiposTramite?: string[]
  // Administrador de Gastos con el gasto ya en trámite de pago o después: cambia datos y bolsa
  // (el backend hace los ajustes de dinero) con motivo; el valor y la forma de pago no se tocan aquí
  edicionAdmin?: boolean
}) {
  const router = useRouter()
  const [guardando, startGuardar] = useTransition()
  const [consultando, startConsultar] = useTransition()
  // Documentos opcionales al crear el gasto (solo tipos de pago)
  const [documentos, setDocumentos] = useState<DocumentoPendiente[]>([])
  const tiposPago = catalogos.tiposDocumento.filter(t => t.paraPago)

  const [datos, setDatos] = useState<DatosGasto>(() => ({
    ...datosIniciales(porcentajeRetencion, gasto),
    ...(anticipo && !gasto ? desdeAnticipo(anticipo, catalogos) : {})
  }))

  const porCajaMenor = catalogos.formasPago.find(f => f.id === datos.formaPagoId)?.codigo === "CAJA_MENOR"
  // La bolsa de no reembolsables solo aparece cuando el gasto no es reembolsable
  const bolsasDelGasto = datos.reembolsable ? bolsas.filter(b => !b.sinSaldo) : bolsas

  // Trámite asociado (opcional)
  const [numeroTramite, setNumeroTramite] = useState(gasto?.solicitudTramiteId ? String(gasto.solicitudTramiteId) : "")
  const [tramite, setTramite] = useState<TramiteApoyo | null>(null)

  // Beneficiario: uno existente o los datos de uno nuevo
  const [beneficiario, setBeneficiario] = useState<Tercero | null>(gasto?.beneficiario ?? null)
  const [beneficiarioNuevo, setBeneficiarioNuevo] = useState<typeof BENEFICIARIO_VACIO | null>(null)

  const cambiar = <K extends keyof DatosGasto>(campo: K, valor: DatosGasto[K]) =>
    setDatos(actuales => ({ ...actuales, [campo]: valor }))

  // Inmueble con liquidación: la base sigue a la liquidación mientras no se haya cambiado aparte
  // (la retención puede aplicar solo a una parte) y el valor solicitado se propone como
  // liquidación − retención; la analista lo puede corregir a mano después
  const cambiarRetencion = (campo: "valorLiquidacion" | "baseRetencion" | "porcentajeRetencion", valor: string) =>
    setDatos(actuales => {
      const nuevos = { ...actuales, [campo]: valor }
      const baseSeguia = !Number(actuales.baseRetencion) || centavos(actuales.baseRetencion) === centavos(actuales.valorLiquidacion)
      if (campo === "valorLiquidacion" && baseSeguia) nuevos.baseRetencion = valor || "0"

      const liquidacionC = centavos(nuevos.valorLiquidacion)
      if (liquidacionC <= 0 || edicionAdmin) return nuevos
      const retencion = Math.round(centavos(nuevos.baseRetencion) * Number(nuevos.porcentajeRetencion || 0) / 100)
      return { ...nuevos, valorSolicitado: String((liquidacionC - retencion) / 100) }
    })

  const codigoTipo = catalogos.tiposGasto.find(t => t.id === datos.tipoGastoId)?.codigo

  // Gasto de anticipo que supera lo que le queda al cliente: se puede crear, pero se avisa
  const excedeSaldo = anticipo ? Number(datos.valorSolicitado || 0) > anticipo.disponible : false
  const llevaRetencion = codigoTipo === "INMUEBLE"

  // Vista previa de la retención (el cálculo definitivo lo hace el backend), en centavos
  const baseC = centavos(datos.baseRetencion)
  const retencionC = Math.round(baseC * Number(datos.porcentajeRetencion || 0) / 100)

  // ── Trámite ─────────────────────────────

  const cargarTramite = () => {
    const id = Number(numeroTramite)
    if (!id) return toast.error("Escriba el número del trámite")

    startConsultar(async () => {
      const resultado = await consultarTramite(id)

      if (!resultado.ok) {
        resultado.errores.forEach(e => toast.error(e))
        return
      }

      const t = resultado.datos
      setTramite(t)

      // Se completa solo lo que esté vacío para no borrar lo ya digitado
      setDatos(actuales => ({
        ...actuales,
        solicitudTramiteId: t.id,
        operacionId: actuales.operacionId ?? t.operacionesId,
        tramitadorId: actuales.tramitadorId ?? t.tramitadorId,
        placa: actuales.placa || (t.placa ?? ""),
        // Trámite de vehículo: el concepto empieza con su tipo de trámite (se puede cambiar)
        conceptoPago: actuales.conceptoPago || (t.placa && t.tramite ? t.tramite.nombreTramite.trim() : ""),
        matriculaInmobiliaria: actuales.matriculaInmobiliaria || (t.matriculaInmobiliaria ?? ""),
        nombreClienteBanco: actuales.nombreClienteBanco || (t.clientes?.nombreCliente ?? ""),
        identificacionClienteBanco: actuales.identificacionClienteBanco || (t.clientes?.identificacionCliente ?? "")
      }))

      toast.success(`Datos del trámite ${t.id} cargados`)
    })
  }

  const quitarTramite = () => {
    setTramite(null)
    setNumeroTramite("")
    cambiar("solicitudTramiteId", null)
  }


  // ── Guardar ─────────────────────────────

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()

    if (edicionAdmin && (datos.motivo ?? "").trim().length < 3) {
      toast.error("Escriba el motivo de la corrección")
      return
    }

    if (!beneficiario && !beneficiarioNuevo) {
      toast.error("Debe seleccionar o registrar el beneficiario del pago")
      return
    }

    if (llevaRetencion) {
      const porcentaje = Number(datos.porcentajeRetencion)
      if (datos.porcentajeRetencion === "" || !(porcentaje >= 0 && porcentaje <= 100)) {
        toast.error("El porcentaje de retención debe estar entre 0 y 100")
        return
      }
      if (baseC < 0) {
        toast.error("La base de retención no puede ser negativa")
        return
      }
    }

    const payload = {
      ...datos,
      ...(anticipo ? { anticipoId: anticipo.id, bolsaId: anticipo.bolsa.id, reembolsable: false } : {}),
      // La retención solo se envía en gastos de inmueble
      valorLiquidacion: llevaRetencion && datos.valorLiquidacion ? datos.valorLiquidacion : null,
      baseRetencion: llevaRetencion ? datos.baseRetencion : null,
      porcentajeRetencion: llevaRetencion ? datos.porcentajeRetencion : null,
      beneficiarioId: beneficiario?.id ?? null,
      beneficiario: beneficiario ? null : beneficiarioNuevo
    }

    startGuardar(async () => {
      const resultado = await guardarGasto(payload, gasto?.id)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      if (gasto) toast.success("Gasto actualizado")
      else avisarGastoCreado(resultado.datos.codigo, resultado.datos.programacion)
      if (!gasto && documentos.length) await subirDocumentosDelGasto(resultado.datos.id, documentos)
      if (resultado.datos.avisoSaldo) toast.warning(resultado.datos.avisoSaldo, { autoClose: 10000 })
      router.push(`/solicitudes/${resultado.datos.id}`)
      router.refresh()
    })
  }


  return (
    <form onSubmit={guardar} className="space-y-6" noValidate>

      {/* ── ANTICIPO ── */}
      {anticipo && (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-sky-200 bg-sky-50 px-5 py-4">
          <div className="flex gap-3 text-xs text-slate-600">
            <HandCoins size={20} className="mt-0.5 shrink-0 text-sky-600" />
            <div>
              <p className="font-semibold text-sky-900">Gasto del anticipo {anticipo.codigo}</p>
              <p className="mt-0.5">Cliente {anticipo.cliente.nombre} · {anticipo.cliente.identificacion} · bolsa {anticipo.bolsa.nombre}</p>
              <p className="mt-0.5">No reembolsable: después del pago lo lleva Contabilidad (no pasa por Legalización).</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Disponible del cliente</p>
            <p className={anticipo.disponible < 0 ? "text-base font-semibold text-red-600" : "text-base font-semibold text-slate-800"}>{formatoMoneda(anticipo.disponible)}</p>
          </div>
        </div>
      )}

      {/* ── TRÁMITE ── */}
      <Seccion titulo="Trámite asociado">
        {datos.solicitudTramiteId ? (
          <div className="flex items-start justify-between gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-emerald-800">Trámite #{datos.solicitudTramiteId}</p>
              {tramite && (
                <p className="mt-0.5">
                  {tramite.tramite?.nombreTramite} · {tramite.clientes?.nombreCliente} · {tramite.operaciones?.nombreOperacion}
                </p>
              )}
            </div>
            <button type="button" onClick={quitarTramite} className="text-slate-400 hover:text-red-500" aria-label="Quitar trámite">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 max-w-md">
            <input
              type="number"
              min={1}
              value={numeroTramite}
              onChange={e => setNumeroTramite(e.target.value)}
              placeholder="Número del trámite"
              className={claseInput}
              aria-label="Número del trámite"
            />
            <button type="button" onClick={cargarTramite} disabled={consultando} className={claseBotonSecundario}>
              {consultando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              Cargar
            </button>
          </div>
        )}
      </Seccion>


      {/* ── DATOS GENERALES ── */}
      <Seccion titulo="Datos del gasto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Operación" obligatorio>
            <Selector
              valor={datos.operacionId}
              opciones={operaciones.map(o => ({
                id: o.id,
                nombre: o.centroDeCostos ? `${o.nombreOperacion} (${o.centroDeCostos})` : o.nombreOperacion
              }))}
              onChange={v => cambiar("operacionId", v)}
            />
          </Campo>

          <Campo etiqueta={porCajaMenor ? "Caja menor" : "Bolsa"} obligatorio>
            {anticipo ? (
              // La del anticipo: no se cambia
              <input value={anticipo.bolsa.nombre} disabled className={claseInput} aria-label="Bolsa" />
            ) : (
            <Selector
              valor={datos.bolsaId}
              // Con Caja menor se elige la caja (Bogotá, Medellín…); si no, una bolsa general
              opciones={(porCajaMenor ? cajas : bolsasDelGasto).map(b => ({
                id: b.id,
                nombre: b.lineaNegocio ? `${b.nombre} · ${b.lineaNegocio}` : b.nombre
              }))}
              onChange={v => cambiar("bolsaId", v)}
              vacio={porCajaMenor
                ? cajas.length ? "Seleccione la caja menor" : "No hay cajas menores activas"
                : bolsasDelGasto.length ? "Seleccione la bolsa" : "No hay bolsas activas"}
            />
            )}
          </Campo>

          <Campo etiqueta="Tipo de gasto" obligatorio>
            <Selector valor={datos.tipoGastoId} opciones={catalogos.tiposGasto} onChange={v => cambiar("tipoGastoId", v)} />
          </Campo>

          <Campo etiqueta="Forma de pago" obligatorio>
            {edicionAdmin ? (
              <input value={catalogos.formasPago.find(f => f.id === datos.formaPagoId)?.nombre ?? ""} disabled className={claseInput} />
            ) : (
            <Selector
              valor={datos.formaPagoId}
              // Los gastos de anticipos se pagan de la bolsa del anticipo, nunca por caja menor
              opciones={anticipo ? catalogos.formasPago.filter(f => f.codigo !== "CAJA_MENOR") : catalogos.formasPago}
              onChange={v => {
                const aCaja = catalogos.formasPago.find(f => f.id === v)?.codigo === "CAJA_MENOR"
                cambiar("formaPagoId", v)
                if (aCaja !== porCajaMenor) cambiar("bolsaId", null)
              }}
            />
            )}
          </Campo>

          <Campo etiqueta="Concepto del pago" obligatorio className="sm:col-span-2">
            <input
              value={datos.conceptoPago}
              onChange={e => cambiar("conceptoPago", e.target.value)}
              list={codigoTipo === "VEHICULO" && tiposTramite.length ? "tipos-tramite" : undefined}
              autoComplete="off"
              maxLength={200}
              placeholder="Ej: Pago derechos de tránsito"
              className={claseInput}
            />
            <datalist id="tipos-tramite">
              {tiposTramite.map(nombre => <option key={nombre} value={nombre} />)}
            </datalist>
          </Campo>

          <Campo etiqueta="Número de factura">
            <input value={datos.numeroFactura} onChange={e => cambiar("numeroFactura", e.target.value)} maxLength={50} className={claseInput} />
          </Campo>

          <Campo etiqueta="Tramitador">
            <Selector
              valor={datos.tramitadorId}
              opciones={tramitadores.map(t => ({ id: t.id, nombre: t.nombreTramitador }))}
              onChange={v => cambiar("tramitadorId", v)}
              vacio="Sin tramitador"
            />
          </Campo>

          <label className="flex items-center gap-2 self-end h-10 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={anticipo ? false : datos.reembolsable}
              disabled={Boolean(anticipo)}
              onChange={e => {
                cambiar("reembolsable", e.target.checked)
                // Al volverlo reembolsable se quita la bolsa de no reembolsables si estaba elegida
                if (e.target.checked && bolsas.find(b => b.id === datos.bolsaId)?.sinSaldo) cambiar("bolsaId", null)
              }}
              className="h-4 w-4 accent-emerald-600"
            />
            {anticipo ? "No reembolsable (el cliente ya pagó el anticipo)" : "Reembolsable (se le cobra al cliente)"}
          </label>
        </div>

        {/* Campos según el tipo de gasto */}
        {codigoTipo === "VEHICULO" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Placa" obligatorio>
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={100} className={claseInput} />
            </Campo>
            <Campo etiqueta="Tránsito" obligatorio>
              <input value={datos.transito} onChange={e => cambiar("transito", e.target.value)} maxLength={100} placeholder="Ej: Tránsito de Bogotá" className={claseInput} />
            </Campo>
          </div>
        )}

        {codigoTipo === "INMUEBLE" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Matrícula inmobiliaria" obligatorio>
              <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
            </Campo>
          </div>
        )}

        {/* CTL: puede ser de un vehículo o de un inmueble (ambos opcionales). Lo paga Tesorería - Certificados */}
        {codigoTipo === "CTL" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Placa (si es de un vehículo)">
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={100} className={claseInput} />
            </Campo>
            <Campo etiqueta="Matrícula inmobiliaria (si es de un inmueble)">
              <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
            </Campo>
          </div>
        )}

        {/* Cámara de Comercio: placa y matrícula inmobiliaria opcionales. Lo paga Tesorería - Certificados */}
        {codigoTipo === "CAMARA_COMERCIO" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Placa">
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={100} className={claseInput} />
            </Campo>
            <Campo etiqueta="Matrícula inmobiliaria">
              <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
            </Campo>
          </div>
        )}

        {/* Certificado RUNT: de un vehículo (placa opcional). Lo paga Tesorería - Certificados */}
        {codigoTipo === "RUNT" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Placa del vehículo">
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={100} className={claseInput} />
            </Campo>
          </div>
        )}

      </Seccion>


      {/* ── CLIENTE / BANCO ── */}
      <Seccion titulo="Cliente / banco">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Nombre del cliente">
            <input value={datos.nombreClienteBanco} onChange={e => cambiar("nombreClienteBanco", e.target.value)} disabled={Boolean(anticipo)} maxLength={200} className={claseInput} />
          </Campo>
          <Campo etiqueta="Identificación del cliente">
            <input value={datos.identificacionClienteBanco} onChange={e => cambiar("identificacionClienteBanco", e.target.value)} disabled={Boolean(anticipo)} maxLength={30} className={claseInput} />
          </Campo>
          <Campo etiqueta="Contrato">
            <input value={datos.contrato} onChange={e => cambiar("contrato", e.target.value)} maxLength={50} className={claseInput} />
          </Campo>
          <Campo etiqueta="Código BPR/FTF">
            <input value={datos.codigoBpr} onChange={e => cambiar("codigoBpr", e.target.value)} maxLength={50} className={claseInput} />
          </Campo>
        </div>
      </Seccion>


      {/* ── BENEFICIARIO ── */}
      <Seccion titulo="Beneficiario del pago">
        {beneficiario ? (
          <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-slate-700">{beneficiario.nombre}</p>
              <p className="mt-0.5">{beneficiario.tipoIdentificacion} {beneficiario.identificacion}</p>
              {beneficiario.banco && (
                <p className="mt-0.5">{beneficiario.banco} · {beneficiario.tipoCuenta} · {beneficiario.numeroCuenta}</p>
              )}
            </div>
            <button type="button" onClick={() => setBeneficiario(null)} className="text-xs font-medium text-emerald-700 hover:underline">
              Cambiar
            </button>
          </div>
        ) : beneficiarioNuevo ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo etiqueta="Tipo de identificación" obligatorio>
                <SelectBuscable
                  value={beneficiarioNuevo.tipoIdentificacion}
                  onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, tipoIdentificacion: e.target.value })}
                  className={claseInput}
                >
                  {["NIT", "CC", "CE", "PAS"].map(t => <option key={t}>{t}</option>)}
                </SelectBuscable>
              </Campo>
              <Campo etiqueta="Identificación" obligatorio>
                <input value={beneficiarioNuevo.identificacion} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, identificacion: e.target.value })} maxLength={30} className={claseInput} />
              </Campo>
              <Campo etiqueta="Nombre o razón social" obligatorio className="sm:col-span-2">
                <input value={beneficiarioNuevo.nombre} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, nombre: e.target.value })} maxLength={200} className={claseInput} />
              </Campo>
              <Campo etiqueta="Banco">
                <input value={beneficiarioNuevo.banco} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, banco: e.target.value })} maxLength={100} className={claseInput} />
              </Campo>
              <Campo etiqueta="Tipo de cuenta">
                <SelectBuscable
                  value={beneficiarioNuevo.tipoCuenta}
                  onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, tipoCuenta: e.target.value })}
                  className={claseInput}
                >
                  <option value="">Sin cuenta</option>
                  <option value="AHORROS">Ahorros</option>
                  <option value="CORRIENTE">Corriente</option>
                </SelectBuscable>
              </Campo>
              <Campo etiqueta="Número de cuenta">
                <input value={beneficiarioNuevo.numeroCuenta} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, numeroCuenta: e.target.value })} maxLength={30} className={claseInput} />
              </Campo>
              <Campo etiqueta="Correo">
                <input type="email" value={beneficiarioNuevo.correo} onChange={e => setBeneficiarioNuevo({ ...beneficiarioNuevo, correo: e.target.value })} maxLength={100} className={claseInput} />
              </Campo>
            </div>
            <button type="button" onClick={() => setBeneficiarioNuevo(null)} className="text-xs font-medium text-slate-500 hover:underline">
              Volver a buscar un beneficiario existente
            </button>
          </div>
        ) : (
          <BuscadorBeneficiario
            onSeleccionar={setBeneficiario}
            onNuevo={identificacion => setBeneficiarioNuevo({ ...BENEFICIARIO_VACIO, identificacion })}
          />
        )}
      </Seccion>


      {/* ── VALOR ── */}
      <Seccion titulo="Valor">
        <div className={`grid gap-4 ${llevaRetencion ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {/* Retención: solo gastos de inmueble */}
          {llevaRetencion && (
            <>
              <Campo etiqueta="Valor liquidación">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={datos.valorLiquidacion ?? ""}
                  onChange={e => cambiarRetencion("valorLiquidacion", e.target.value)}
                  placeholder="0"
                  className={claseInput}
                />
              </Campo>
              <Campo etiqueta="Base de retención">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={datos.baseRetencion ?? ""}
                  onChange={e => cambiarRetencion("baseRetencion", e.target.value)}
                  placeholder="0 si no aplica"
                  className={claseInput}
                />
              </Campo>
              <Campo etiqueta="Porcentaje de retención (%)" obligatorio>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={datos.porcentajeRetencion ?? ""}
                  onChange={e => cambiarRetencion("porcentajeRetencion", e.target.value)}
                  className={claseInput}
                />
              </Campo>
            </>
          )}

          <Campo etiqueta="Valor solicitado" obligatorio>
            <input
              type="number"
              min={0}
              step="0.01"
              value={datos.valorSolicitado}
              onChange={e => cambiar("valorSolicitado", e.target.value)}
              placeholder="0"
              disabled={edicionAdmin}
              className={claseInput}
            />
          </Campo>
        </div>

        {excedeSaldo && anticipo && (
          <p className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            El valor supera lo que le queda al cliente ({formatoMoneda(anticipo.disponible)}): faltan {formatoMoneda(Number(datos.valorSolicitado) - anticipo.disponible)}.
            Se puede crear, pero Tesorería y Dirección de Negocio verán el aviso.
          </p>
        )}

        {llevaRetencion && (
          <CalculoRetencion
            liquidacionC={centavos(datos.valorLiquidacion)}
            baseC={baseC}
            porcentaje={datos.porcentajeRetencion || "0"}
            retencionC={retencionC}
            solicitadoC={centavos(datos.valorSolicitado)}
          />
        )}
      </Seccion>


      {/* ── DOCUMENTOS (solo al crear) ── */}
      {!gasto && (
        <Seccion titulo="Documentos (opcional)">
          <DocumentosNuevoGasto tipos={tiposPago} documentos={documentos} onCambiar={setDocumentos} />
        </Seccion>
      )}


      {/* ── OBSERVACIÓN ── */}
      <Seccion titulo="Observación">
        <textarea
          value={datos.observacion}
          onChange={e => cambiar("observacion", e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Información adicional para Tesorería (opcional)"
          className={claseTextarea}
        />
      </Seccion>


      {edicionAdmin && (
        <Seccion titulo="Motivo de la corrección">
          <textarea
            value={datos.motivo ?? ""}
            onChange={e => cambiar("motivo", e.target.value)}
            rows={2}
            maxLength={500}
            required
            className={claseTextarea}
          />
        </Seccion>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className={claseBotonSecundario}>Cancelar</button>
        <button type="submit" disabled={guardando} className={claseBotonPrimario}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {gasto ? "Guardar cambios" : "Crear gasto"}
        </button>
      </div>

    </form>
  )
}
