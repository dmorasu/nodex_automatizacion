import "server-only"
import { z } from "zod"
import { notFound } from "next/navigation"
import { fetchApi } from "./api"
import {
  AnticipoDetalleSchema,
  BolsaApoyoSchema,
  ClienteEmpresarialSchema,
  ListadoAnticiposSchema,
  ResumenAnticiposSchema,
  SaldosClientesSchema
} from "../schemas/gastos"
import { obtenerOperaciones } from "./datosGastos"

export type FiltrosAnticipos = {
  alcance?: "mios" | "todos"
  clase?: string
  estado?: string
  busqueda?: string
  pagina?: number
  tamano?: number
}

export const obtenerAnticipos = async (filtros: FiltrosAnticipos) => {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== "") params.set(clave, String(valor))
  })
  const req = await fetchApi(`/gastos/anticipos?${params}`)
  if (!req.ok) throw new Error("No se pudieron cargar los anticipos")
  return ListadoAnticiposSchema.parse(await req.json())
}

export const obtenerAnticipo = async (id: number) => {
  const req = await fetchApi(`/gastos/anticipos/${id}`)
  if (req.status === 404) notFound()
  if (!req.ok) throw new Error(`No se pudo cargar el anticipo ${id}`)
  return AnticipoDetalleSchema.parse(await req.json())
}

export const obtenerResumenAnticipos = async () => {
  const req = await fetchApi("/gastos/anticipos/resumen")
  return req.ok ? ResumenAnticiposSchema.parse(await req.json()) : null
}

export const obtenerClientesEmpresariales = async (todos = false) =>
  z.array(ClienteEmpresarialSchema).parse(await (await fetchApi(`/gastos/clientes-empresariales${todos ? "?todos=si" : ""}`)).json())

// ANTICIPOS para los anticipos; FACTURAS (anticipos facturados) para las solicitudes de factura
export const obtenerBolsasAnticipos = async (tipo: "ANTICIPOS" | "FACTURAS" = "ANTICIPOS") =>
  z.array(BolsaApoyoSchema).parse(await (await fetchApi(`/gastos/apoyo/bolsas?tipo=${tipo}`)).json())

export type FiltrosArqueo = { busqueda?: string, filtro?: string, orden?: string, pagina?: string }

export const obtenerSaldosClientes = async (bolsaId: number, filtros: FiltrosArqueo = {}) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][])
  const req = await fetchApi(`/gastos/bolsas/${bolsaId}/clientes?${params}`)
  return req.ok ? SaldosClientesSchema.parse(await req.json()) : null
}

// Todo lo que necesita el formulario del anticipo o de la solicitud de factura
export const obtenerDatosFormularioAnticipo = async () => {
  const [operaciones, bolsasAnticipos, bolsasFacturas, clientesEmpresariales] = await Promise.all([
    obtenerOperaciones(),
    obtenerBolsasAnticipos("ANTICIPOS"),
    obtenerBolsasAnticipos("FACTURAS"),
    obtenerClientesEmpresariales()
  ])
  return { operaciones, bolsas: { ANTICIPO: bolsasAnticipos, FACTURA: bolsasFacturas }, clientesEmpresariales }
}
