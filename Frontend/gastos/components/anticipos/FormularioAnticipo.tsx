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
    direccion: anticipo?.cliente.direccion ?? ""
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
  observacion: anticipo?.observacion ?? ""
})

function Campo({ etiqueta, children, className }: { etiqueta: string, children: React.ReactNode, className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={claseLabel}>{etiqueta} <span className="text-red-400">*</span></span>
      {children}
    </label>
  )
}

// Registro (o corrección) del anticipo de un cliente del banco o de una solicitud de factura.
// Todos los campos son obligatorios, incluido el soporte de la consignación (al corregir, basta
// con el que ya tiene). El número de solicitud es el código que asigna el sistema (ANT-… / FAC-…).
// La clase se elige al crearlo y después no cambia.
export default function FormularioAnticipo({
  operaciones,
  bolsas: bolsasPorClase,
  clientesEmpresariales,
  anticipo,
  claseInicial = "ANTICIPO"
}: {
  operaciones: Operacion[]
  bolsas: Record<Clase, BolsaApoyo[]>
  clientesEmpresariales: ClienteEmpresarial[]
  anticipo?: AnticipoDetalle
  claseInicial?: Clase
}) {
  const router = useRouter()
  const [guardando, startGuardar] = useTransition()
  const [datos, setDatos] = useState<DatosAnticipo>(() => {
    const clase = (anticipo?.clase as Clase | undefined) ?? claseInicial
    return datosIniciales(clase, bolsasPorClase[clase], anticipo)
  })
  const [archivos, setArchivos] = useState<File[]>([])
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
        direccion: actuales.cliente.direccion || (encontrado.direccion ?? "")
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
      !datos.clienteEmpresarialId && "el cliente empresarial",
      !datos.operacionId && "la operación",
      !datos.bolsaId && "la bolsa",
      !datos.concepto.trim() && "el concepto",
      esVehiculo && !datos.placa.trim() && "la placa",
      !esVehiculo && !datos.matriculaInmobiliaria.trim() && "la matrícula inmobiliaria",
      !(Number(datos.valorConsignado) > 0) && "el valor consignado",
      !datos.fechaConsignacion && "la fecha de consignación",
      !anticipo && archivos.length === 0 && "el soporte de la consignación"
    ].filter(Boolean)
    if (faltantes.length) return toast.error(`Falta ${faltantes.join(", ")}`)

    const formData = new FormData()
    formData.append("datos", JSON.stringify({
      ...datos,
      placa: esVehiculo ? datos.placa : null,
      matriculaInmobiliaria: esVehiculo ? null : datos.matriculaInmobiliaria,
      valorConsignado: Number(datos.valorConsignado)
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
            <select
              value={datos.cliente.tipoIdentificacion}
              onChange={e => cambiarCliente("tipoIdentificacion", e.target.value)}
              className={claseInput}
            >
              <option value="CC">Cédula</option>
              <option value="NIT">NIT</option>
            </select>
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
          <Campo etiqueta="Dirección" className="sm:col-span-2">
            <input value={datos.cliente.direccion} onChange={e => cambiarCliente("direccion", e.target.value)} maxLength={200} className={claseInput} />
          </Campo>
          <Campo etiqueta="Cliente empresarial">
            <select
              value={datos.clienteEmpresarialId ?? ""}
              onChange={e => cambiar("clienteEmpresarialId", e.target.value ? Number(e.target.value) : null)}
              className={claseInput}
            >
              <option value="">{clientesEmpresariales.length ? "Seleccione" : "No hay clientes empresariales"}</option>
              {clientesEmpresariales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        </div>
        {clienteExistente && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <UserCheck size={14} /> Cliente ya registrado: {clienteExistente}. Se actualizan su teléfono y dirección.
          </p>
        )}
      </Seccion>

      <Seccion titulo={esFactura ? "Datos de la solicitud" : "Datos del anticipo"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo etiqueta="Operación">
            <select
              value={datos.operacionId ?? ""}
              onChange={e => cambiar("operacionId", e.target.value ? Number(e.target.value) : null)}
              className={claseInput}
            >
              <option value="">Seleccione la operación</option>
              {operaciones.map(o => <option key={o.id} value={o.id}>{o.centroDeCostos ? `${o.nombreOperacion} (${o.centroDeCostos})` : o.nombreOperacion}</option>)}
            </select>
          </Campo>
          <Campo etiqueta={esFactura ? "Bolsa de anticipos facturados" : "Bolsa de anticipos"}>
            <select
              value={datos.bolsaId ?? ""}
              onChange={e => cambiar("bolsaId", e.target.value ? Number(e.target.value) : null)}
              className={claseInput}
            >
              <option value="">{bolsas.length ? "Seleccione la bolsa" : esFactura ? "No hay bolsas de anticipos facturados activas" : "No hay bolsas de anticipos activas"}</option>
              {bolsas.map(b => <option key={b.id} value={b.id}>{b.lineaNegocio ? `${b.nombre} · ${b.lineaNegocio}` : b.nombre}</option>)}
            </select>
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
        </div>
      </Seccion>

      <Seccion
        titulo="Soporte de la consignación"
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
