"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import clsx from "clsx"
import { Car, FileText, HandCoins, Home, Loader2, Paperclip, Save, Send, UserCheck } from "lucide-react"
import { buscarTerceros } from "@/actions/gastos/gastos"
import { guardarAnticipo } from "@/actions/gastos/anticipos"
import type { AnticipoDetalle, BolsaApoyo, ClienteEmpresarial, DatosAnticipo, Operacion } from "@/src/schemas/gastos"
import Seccion from "../ui/Seccion"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"
import SelectBuscable from "@/components/ui/SelectBuscable"
import { formatoMoneda, liquidarFactura } from "@/src/lib/formato"
import BuscadorMunicipio from "@/components/ui/BuscadorMunicipio"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

type Clase = DatosAnticipo["clase"]

// Las solicitudes de factura casi siempre son de inmuebles
const TIPO_POR_DEFECTO: Record<Clase, DatosAnticipo["tipo"]> = { ANTICIPO: "VEHICULO", FACTURA: "INMUEBLE" }

// Con una sola bolsa de la clase, queda elegida
const bolsaUnica = (bolsas: BolsaApoyo[]) => bolsas.length === 1 ? bolsas[0].id : null

const datosIniciales = (clase: Clase, bolsas: BolsaApoyo[], anticipo?: AnticipoDetalle): DatosAnticipo => ({
  clase,
  tipo: (anticipo?.tipo as DatosAnticipo["tipo"]) ?? TIPO_POR_DEFECTO[clase],
  cliente: {
    tipoIdentificacion: (anticipo?.cliente.tipoIdentificacion === "NIT" ? "NIT" : "CC"),
    identificacion: anticipo?.cliente.identificacion ?? "",
    nombre: anticipo?.cliente.nombre ?? "",
    telefono: anticipo?.cliente.telefono ?? "",
    direccion: anticipo?.cliente.direccion ?? "",
    ciudad: anticipo?.cliente.ciudad ?? "",
    correo: anticipo?.cliente.correo ?? ""
  },
  clienteEmpresarialId: anticipo?.clienteEmpresarialId ?? null,
  operacionId: anticipo?.operacionId ?? null,
  bolsaId: anticipo?.bolsaId ?? bolsaUnica(bolsas),
  concepto: anticipo?.concepto ?? "",
  placa: anticipo?.placa ?? "",
  matriculaInmobiliaria: anticipo?.matriculaInmobiliaria ?? "",
  valorConsignado: anticipo ? String(Number(anticipo.valorConsignado)) : "",
  // Por defecto hoy (se puede cambiar si consignó otro día)
  fechaConsignacion: anticipo?.fechaConsignacion ?? hoyEnBogota(),
  referenciaPago: anticipo?.referenciaPago ?? "",
  observacion: anticipo?.observacion ?? "",
  // Se guarda como fracción (0.11); en pantalla va en porcentaje (11)
  retencionPorcentaje: anticipo?.retencionPorcentaje ? String(Number((Number(anticipo.retencionPorcentaje) * 100).toFixed(4))) : ""
})

// "11" o "11,5" → 0.11 / 0.115; vacío o 0 → null (no aplica)
const fraccionRetencion = (texto: string) => {
  const valor = Number(texto.replace(",", "."))
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 10000) / 1000000 : null
}

function Campo({ etiqueta, children, className, opcional }: { etiqueta: string, children: React.ReactNode, className?: string, opcional?: boolean }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={claseLabel}>{etiqueta} {!opcional && <span className="text-red-400">*</span>}</span>
      {children}
    </label>
  )
}

// Registro (o corrección) del anticipo de un cliente del banco o de una solicitud de factura.
// Todos los campos son obligatorios. Del pago, el soporte de la consignación o, si no lo tienen,
// la referencia del pago (al corregir, basta con el soporte que ya tiene). El número de solicitud
// es el código que asigna el sistema (ANT-… / FAC-…).
// La clase se elige al crearlo y después no cambia.
export default function FormularioAnticipo({
  operaciones,
  bolsas: bolsasPorClase,
  clientesEmpresariales,
  anticipo,
  claseInicial = "ANTICIPO",
  tasaIva = 0
}: {
  operaciones: Operacion[]
  bolsas: Record<Clase, BolsaApoyo[]>
  clientesEmpresariales: ClienteEmpresarial[]
  anticipo?: AnticipoDetalle
  claseInicial?: Clase
  // Solicitud de factura: tarifa del IVA, que ya viene incluido en el valor consignado (0.19)
  tasaIva?: number
}) {
  const router = useRouter()
  const [guardando, startGuardar] = useTransition()
  const [datos, setDatos] = useState<DatosAnticipo>(() => {
    const clase = (anticipo?.clase as Clase | undefined) ?? claseInicial
    return datosIniciales(clase, bolsasPorClase[clase], anticipo)
  })
  const [archivos, setArchivos] = useState<File[]>([])
  // Corrección del administrador fuera de por confirmar / con novedad: motivo obligatorio y, si ya
  // entró el dinero, el valor recibido, el recibo de caja (anticipo) o el número de factura
  const edicionAdmin = Boolean(anticipo?.permisos.edicionAdmin)
  const conDinero = anticipo?.estado === "CONFIRMADO" || anticipo?.estado === "FACTURADO"
  const [correccion, setCorreccion] = useState({
    motivo: "",
    valorRecibido: anticipo?.valorRecibido ? String(Number(anticipo.valorRecibido)) : "",
    reciboCaja: anticipo?.reciboCaja ?? "",
    numeroFactura: anticipo?.numeroFactura ?? ""
  })
  const cambiarCorreccion = (campo: keyof typeof correccion, valor: string) => setCorreccion(c => ({ ...c, [campo]: valor }))
  // Nombre del cliente si ya está registrado: su nombre no se cambia desde aquí
  const [clienteExistente, setClienteExistente] = useState<string | null>(anticipo?.cliente.nombre ?? null)

  const cambiar = <K extends keyof DatosAnticipo>(campo: K, valor: DatosAnticipo[K]) =>
    setDatos(actuales => ({ ...actuales, [campo]: valor }))
  const cambiarCliente = (campo: keyof DatosAnticipo["cliente"], valor: string) =>
    setDatos(actuales => ({ ...actuales, cliente: { ...actuales.cliente, [campo]: valor } }))

  const esVehiculo = datos.tipo === "VEHICULO"
  const conNovedad = anticipo?.estado === "NOVEDAD"
  const esFactura = datos.clase === "FACTURA"
  const bolsas = bolsasPorClase[datos.clase]

  // Cada clase tiene su bolsa (anticipos o anticipos facturados) y su tipo por defecto
  const cambiarClase = (clase: Clase) =>
    setDatos(actuales => actuales.clase === clase ? actuales : {
      ...actuales,
      clase,
      tipo: TIPO_POR_DEFECTO[clase],
      bolsaId: bolsaUnica(bolsasPorClase[clase])
    })

  // Si el cliente ya pagó antes, se completan sus datos (el saldo se lleva por identificación)
  const buscarCliente = async () => {
    const identificacion = datos.cliente.identificacion.trim()
    if (identificacion.length < 3) return setClienteExistente(null)
    const encontrado = (await buscarTerceros(identificacion)).find(t => t.identificacion === identificacion)
    setClienteExistente(encontrado ? encontrado.nombre : null)
    if (!encontrado) return
    setDatos(actuales => ({
      ...actuales,
      cliente: {
        tipoIdentificacion: encontrado.tipoIdentificacion === "NIT" ? "NIT" : "CC",
        identificacion,
        nombre: encontrado.nombre,
        telefono: actuales.cliente.telefono || (encontrado.telefono ?? ""),
        direccion: actuales.cliente.direccion || (encontrado.direccion ?? ""),
        ciudad: actuales.cliente.ciudad || (encontrado.ciudad ?? ""),
        correo: actuales.cliente.correo || (encontrado.correo ?? "")
      }
    }))
  }

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()

    const faltantes = [
      !datos.cliente.identificacion.trim() && "la identificación del cliente",
      !datos.cliente.nombre.trim() && "el nombre del cliente",
      !datos.cliente.telefono.trim() && "el teléfono",
      !datos.cliente.direccion.trim() && "la dirección",
      esFactura && !datos.cliente.ciudad.trim() && "la ciudad de la dirección",
      esFactura && !datos.cliente.correo.trim() && "el correo del cliente",
      !datos.clienteEmpresarialId && "el cliente empresarial",
      !datos.operacionId && "la operación",
      !datos.bolsaId && "la bolsa",
      !datos.concepto.trim() && "el concepto",
      esVehiculo && !datos.placa.trim() && "la placa",
      !esVehiculo && !datos.matriculaInmobiliaria.trim() && "la matrícula inmobiliaria",
      !(Number(datos.valorConsignado) > 0) && "el valor consignado",
      esFactura && datos.retencionPorcentaje.trim() && !(Number(datos.retencionPorcentaje.replace(",", ".")) >= 0 && Number(datos.retencionPorcentaje.replace(",", ".")) <= 50) && "una retención en la fuente entre 0 % y 50 %",
      !datos.fechaConsignacion && "la fecha de consignación",
      // Sin soporte, la referencia del pago (al corregir, el backend cuenta los soportes que ya tiene)
      !anticipo && archivos.length === 0 && !datos.referenciaPago.trim() && "el soporte de la consignación o la referencia del pago",
      edicionAdmin && !correccion.motivo.trim() && "el motivo de la corrección",
      edicionAdmin && conDinero && !(Number(correccion.valorRecibido) > 0) && "el valor recibido",
      edicionAdmin && anticipo?.estado === "CONFIRMADO" && !correccion.reciboCaja.trim() && "el recibo de caja",
      edicionAdmin && anticipo?.estado === "FACTURADO" && !correccion.numeroFactura.trim() && "el número de factura"
    ].filter(Boolean)
    if (faltantes.length) return toast.error(`Falta ${faltantes.join(", ")}`)

    const formData = new FormData()
    formData.append("datos", JSON.stringify({
      ...datos,
      placa: esVehiculo ? datos.placa : null,
      matriculaInmobiliaria: esVehiculo ? null : datos.matriculaInmobiliaria,
      valorConsignado: Number(datos.valorConsignado),
      retencionPorcentaje: esFactura ? fraccionRetencion(datos.retencionPorcentaje) : null,
      ...(edicionAdmin ? {
        motivo: correccion.motivo,
        ...(conDinero ? { valorRecibido: Number(correccion.valorRecibido) } : {}),
        ...(anticipo?.estado === "CONFIRMADO" ? { reciboCaja: correccion.reciboCaja } : {}),
        ...(anticipo?.estado === "FACTURADO" ? { numeroFactura: correccion.numeroFactura } : {})
      } : {})
    }))
    archivos.forEach(archivo => formData.append("archivos", archivo))

    startGuardar(async () => {
      const resultado = await guardarAnticipo(formData, anticipo?.id)
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      const mensajes = esFactura
        ? { reenviado: "Solicitud corregida y enviada de nuevo a Contabilidad", actualizado: "Solicitud actualizada", creado: "Solicitud de factura registrada: queda por facturar en Contabilidad" }
        : { reenviado: "Anticipo corregido y enviado de nuevo a Contabilidad", actualizado: "Anticipo actualizado", creado: "Anticipo registrado: queda por confirmar en Contabilidad" }
      toast.success(anticipo ? resultado.datos.reenviado ? mensajes.reenviado : mensajes.actualizado : mensajes.creado)
      router.push(`/anticipos/${resultado.datos.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={guardar} className="space-y-6" noValidate>

      {conNovedad && anticipo?.motivoNovedad && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span className="font-semibold">Novedad de Contabilidad:</span> {anticipo.motivoNovedad}
          <p className="mt-1 text-red-600/80">Al guardar, {esFactura ? "la solicitud vuelve" : "el anticipo vuelve"} a Contabilidad para revisión.</p>
        </div>
      )}

      {!anticipo && (
        <Seccion titulo="¿Qué va a registrar?">
          <div className="grid max-w-md grid-cols-2 gap-3">
            {([["ANTICIPO", "Anticipo", HandCoins], ["FACTURA", "Solicitud de factura", FileText]] as const).map(([valor, etiqueta, Icono]) => (
              <button
                key={valor}
                type="button"
                onClick={() => cambiarClase(valor)}
                aria-pressed={datos.clase === valor}
                className={clsx("flex h-12 items-center justify-center gap-2 rounded-md border text-xs font-semibold transition",
                  datos.clase === valor ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300")}
              >
                <Icono size={16} /> {etiqueta}
              </button>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Vehículo o inmueble">
        <div className="grid max-w-md grid-cols-2 gap-3">
          {([["VEHICULO", "Vehículo", Car], ["INMUEBLE", "Inmueble", Home]] as const).map(([valor, nombre, Icono]) => (
            <button
              key={valor}
              type="button"
              onClick={() => cambiar("tipo", valor)}
              aria-pressed={datos.tipo === valor}
              className={clsx("flex h-12 items-center justify-center gap-2 rounded-md border text-xs font-semibold transition",
                datos.tipo === valor ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300")}
            >
              <Icono size={16} /> {nombre}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Cliente del banco">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Tipo de identificación">
            <SelectBuscable
              value={datos.cliente.tipoIdentificacion}
              onChange={e => cambiarCliente("tipoIdentificacion", e.target.value)}
              className={claseInput}
            >
              <option value="CC">Cédula</option>
              <option value="NIT">NIT</option>
            </SelectBuscable>
          </Campo>
          <Campo etiqueta="Identificación">
            <input
              value={datos.cliente.identificacion}
              onChange={e => cambiarCliente("identificacion", e.target.value)}
              onBlur={buscarCliente}
              maxLength={30}
              className={claseInput}
            />
          </Campo>
          <Campo etiqueta="Nombre del cliente" className="sm:col-span-2">
            <input
              value={datos.cliente.nombre}
              onChange={e => cambiarCliente("nombre", e.target.value)}
              disabled={Boolean(clienteExistente)}
              maxLength={200}
              className={claseInput}
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input value={datos.cliente.telefono} onChange={e => cambiarCliente("telefono", e.target.value)} maxLength={30} className={claseInput} />
          </Campo>
          {/* Contabilidad factura con el correo y la ciudad: obligatorios en las solicitudes de factura */}
          <Campo etiqueta="Correo del cliente" opcional={!esFactura}>
            <input type="email" value={datos.cliente.correo} onChange={e => cambiarCliente("correo", e.target.value.trim())} maxLength={100} className={claseInput} />
          </Campo>
          <Campo etiqueta="Dirección" className="sm:col-span-2">
            <input value={datos.cliente.direccion} onChange={e => cambiarCliente("direccion", e.target.value)} maxLength={200} className={claseInput} />
          </Campo>
          <Campo etiqueta="Ciudad de la dirección" opcional={!esFactura}>
            <BuscadorMunicipio valor={datos.cliente.ciudad} onCambiar={valor => cambiarCliente("ciudad", valor)} />
          </Campo>
          <Campo etiqueta="Cliente empresarial">
            <SelectBuscable
              value={datos.clienteEmpresarialId ?? ""}
              onChange={e => cambiar("clienteEmpresarialId", e.target.value ? Number(e.target.value) : null)}
              className={claseInput}
            >
              <option value="">{clientesEmpresariales.length ? "Seleccione" : "No hay clientes empresariales"}</option>
              {clientesEmpresariales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </SelectBuscable>
          </Campo>
        </div>
        {clienteExistente && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <UserCheck size={14} /> Cliente ya registrado: {clienteExistente}. Se actualizan su teléfono, correo, dirección y ciudad.
          </p>
        )}
      </Seccion>

      <Seccion titulo={esFactura ? "Datos de la solicitud" : "Datos del anticipo"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Operación">
            <SelectBuscable
              value={datos.operacionId ?? ""}
              onChange={e => cambiar("operacionId", e.target.value ? Number(e.target.value) : null)}
              className={claseInput}
            >
              <option value="">Seleccione la operación</option>
              {operaciones.map(o => <option key={o.id} value={o.id}>{o.centroDeCostos ? `${o.nombreOperacion} (${o.centroDeCostos})` : o.nombreOperacion}</option>)}
            </SelectBuscable>
          </Campo>
          <Campo etiqueta={esFactura ? "Bolsa de anticipos facturados" : "Bolsa de anticipos"}>
            <SelectBuscable
              value={datos.bolsaId ?? ""}
              onChange={e => cambiar("bolsaId", e.target.value ? Number(e.target.value) : null)}
              // Con el dinero ya en la bolsa no se cambia (sus gastos se pagan desde ella)
              disabled={conDinero}
              className={claseInput}
            >
              <option value="">{bolsas.length ? "Seleccione la bolsa" : esFactura ? "No hay bolsas de anticipos facturados activas" : "No hay bolsas de anticipos activas"}</option>
              {bolsas.map(b => <option key={b.id} value={b.id}>{b.lineaNegocio ? `${b.nombre} · ${b.lineaNegocio}` : b.nombre}</option>)}
            </SelectBuscable>
          </Campo>
          <Campo etiqueta="Concepto" className="sm:col-span-2">
            <input value={datos.concepto} onChange={e => cambiar("concepto", e.target.value)} maxLength={200} placeholder={esFactura ? "Ej: Honorarios escrituración" : "Ej: Anticipo traspaso"} className={claseInput} />
          </Campo>
          {esVehiculo ? (
            <Campo etiqueta="Placa">
              <input value={datos.placa} onChange={e => cambiar("placa", e.target.value.toUpperCase())} maxLength={20} className={claseInput} />
            </Campo>
          ) : (
            <Campo etiqueta="Matrícula inmobiliaria">
              <input value={datos.matriculaInmobiliaria} onChange={e => cambiar("matriculaInmobiliaria", e.target.value)} maxLength={50} className={claseInput} />
            </Campo>
          )}
          <Campo etiqueta="Valor consignado">
            <input type="number" min={0} step="0.01" value={datos.valorConsignado} onChange={e => cambiar("valorConsignado", e.target.value)} placeholder="0" className={claseInput} />
          </Campo>
          <Campo etiqueta="Fecha de consignación">
            <input type="date" value={datos.fechaConsignacion} onChange={e => cambiar("fechaConsignacion", e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Referencia de pago" opcional={archivos.length > 0 || (anticipo?.documentos.length ?? 0) > 0}>
            <input value={datos.referenciaPago} onChange={e => cambiar("referenciaPago", e.target.value)} maxLength={100} className={claseInput} />
          </Campo>
          {esFactura && (
            <Campo etiqueta="Retención en la fuente (%)" opcional>
              <input
                type="number" min={0} max={50} step="0.01"
                value={datos.retencionPorcentaje}
                onChange={e => cambiar("retencionPorcentaje", e.target.value)}
                placeholder="0 si no aplica"
                className={claseInput}
              />
            </Campo>
          )}
        </div>

        {/* Solicitud de factura: todo sale del valor consignado (también al corregir una ya facturada).
            base = consignado ÷ (1 + IVA − retención); IVA y retención sobre la base. Al corregir, con la
            tarifa de IVA con que se registró */}
        {esFactura && Number(datos.valorConsignado) > 0 && (() => {
          const tarifa = anticipo?.ivaPorcentaje ? Number(anticipo.ivaPorcentaje) : tasaIva
          const tarifaRetencion = fraccionRetencion(datos.retencionPorcentaje) ?? 0
          const { base, iva, retencion, totalFactura, consignado } = liquidarFactura(Math.round(Number(datos.valorConsignado) * 100), tarifa, tarifaRetencion)
          const porcentaje = (t: number) => `${Math.round(t * 10000) / 100} %`
          return (
            <div className="mt-4 max-w-md space-y-1.5 rounded-md bg-slate-50 px-4 py-3 text-xs">
              <p className="flex justify-between gap-4"><span className="text-slate-500">Base</span><b className="tabular-nums">{formatoMoneda(base / 100)}</b></p>
              <p className="flex justify-between gap-4"><span className="text-slate-500">IVA ({porcentaje(tarifa)})</span><b className="tabular-nums">+ {formatoMoneda(iva / 100)}</b></p>
              <p className="flex justify-between gap-4"><span className="text-slate-500">Total de la factura</span><b className="tabular-nums">{formatoMoneda(totalFactura / 100)}</b></p>
              {tarifaRetencion > 0 && (
                <p className="flex justify-between gap-4"><span className="text-slate-500">Retención en la fuente ({porcentaje(tarifaRetencion)})</span><b className="tabular-nums">− {formatoMoneda(retencion / 100)}</b></p>
              )}
              <p className="flex justify-between gap-4 border-t border-slate-200 pt-1.5 text-sm text-slate-800"><span className="text-slate-500">Valor a pagar (valor consignado)</span><b className="tabular-nums">{formatoMoneda(consignado / 100)}</b></p>
            </div>
          )
        })()}
      </Seccion>

      <Seccion
        titulo="Soporte de la consignación (o la referencia de pago)"
      >
        <label className={`${claseBotonSecundario} cursor-pointer`}>
          <Paperclip size={15} />
          Seleccionar archivos
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            onChange={e => setArchivos(Array.from(e.target.files ?? []))}
          />
        </label>
        {archivos.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {archivos.map(a => <li key={a.name}>· {a.name}</li>)}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Observación">
        <textarea
          value={datos.observacion}
          onChange={e => cambiar("observacion", e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Información adicional para Contabilidad (opcional)"
          className={claseTextarea}
        />
      </Seccion>

      {edicionAdmin && (
        <Seccion titulo="Corrección del administrador">
          <div className="grid gap-4 sm:grid-cols-3">
            {conDinero && (
              <Campo etiqueta="Valor recibido">
                <input type="number" min={0} step="0.01" value={correccion.valorRecibido} onChange={e => cambiarCorreccion("valorRecibido", e.target.value)} className={claseInput} />
              </Campo>
            )}
            {anticipo?.estado === "CONFIRMADO" && (
              <Campo etiqueta="Recibo de caja">
                <input value={correccion.reciboCaja} onChange={e => cambiarCorreccion("reciboCaja", e.target.value)} maxLength={50} className={claseInput} />
              </Campo>
            )}
            {anticipo?.estado === "FACTURADO" && (
              <Campo etiqueta="Número de factura">
                <input value={correccion.numeroFactura} onChange={e => cambiarCorreccion("numeroFactura", e.target.value.toUpperCase())} maxLength={50} className={claseInput} />
              </Campo>
            )}
            <Campo etiqueta="Motivo de la corrección" className="sm:col-span-3">
              <textarea value={correccion.motivo} onChange={e => cambiarCorreccion("motivo", e.target.value)} rows={2} maxLength={1000} className={claseTextarea} />
            </Campo>
          </div>
          {conDinero && anticipo && Number(correccion.valorRecibido) > 0 && Number(correccion.valorRecibido) !== Number(anticipo.valorRecibido ?? anticipo.valorConsignado) && (
            <p className="mt-3 text-xs text-amber-700">
              La bolsa se ajusta por la diferencia: {formatoMoneda(Number(correccion.valorRecibido) - Number(anticipo.valorRecibido ?? anticipo.valorConsignado))} a nombre del cliente.
            </p>
          )}
        </Seccion>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className={claseBotonSecundario}>Cancelar</button>
        <button type="submit" disabled={guardando} className={claseBotonPrimario}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : conNovedad ? <Send size={15} /> : <Save size={15} />}
          {anticipo ? conNovedad ? "Corregir y reenviar" : "Guardar cambios" : esFactura ? "Registrar solicitud de factura" : "Registrar anticipo"}
        </button>
      </div>
    </form>
  )
}
