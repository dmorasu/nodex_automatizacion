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

export const obtenerBolsasAnticipos = async () =>
  z.array(BolsaApoyoSchema).parse(await (await fetchApi("/gastos/apoyo/bolsas?tipo=ANTICIPOS")).json())

export type FiltrosArqueo = { busqueda?: string, filtro?: string, orden?: string, pagina?: string }

export const obtenerSaldosClientes = async (bolsaId: number, filtros: FiltrosArqueo = {}) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][])
  const req = await fetchApi(`/gastos/bolsas/${bolsaId}/clientes?${params}`)
  return req.ok ? SaldosClientesSchema.parse(await req.json()) : null
}

// Todo lo que necesita el formulario del anticipo
export const obtenerDatosFormularioAnticipo = async () => {
  const [operaciones, bolsas, clientesEmpresariales] = await Promise.all([
    obtenerOperaciones(),
    obtenerBolsasAnticipos(),
    obtenerClientesEmpresariales()
  ])
  return { operaciones, bolsas, clientesEmpresariales }
}
