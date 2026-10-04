import "server-only"
import { z } from "zod"
import { notFound } from "next/navigation"
import { fetchApi } from "./api"
import {
  BolsaApoyoSchema,
  CatalogosSchema,
  GastoDetalleSchema,
  OperacionSchema,
  ParametrosSchema,
  TramitadorSchema
} from "../schemas/gastos"

// Lecturas del backend que usan varias páginas del módulo

export const obtenerCatalogos = async () =>
  CatalogosSchema.parse(await (await fetchApi("/gastos/catalogos")).json())

// Tasas vigentes para las vistas previas (el cálculo definitivo lo hace el backend)
export const obtenerTasas = async () => {
  const parametros = ParametrosSchema.parse(await (await fetchApi("/gastos/parametros")).json())
  const valor = (clave: string) => Number(parametros.find(p => p.clave === clave)?.valor ?? 0)
  return { retencion: valor("RETENCION_FUENTE"), gmf: valor("GMF") }
}

export const obtenerOperaciones = async () =>
  z.array(OperacionSchema).parse(await (await fetchApi("/gastos/apoyo/operaciones")).json())

export const obtenerBolsasActivas = async () =>
  z.array(BolsaApoyoSchema).parse(await (await fetchApi("/gastos/apoyo/bolsas")).json())

export const obtenerTramitadores = async () =>
  z.array(TramitadorSchema).parse(await (await fetchApi("/gastos/apoyo/tramitadores")).json())

export const obtenerGasto = async (id: number) => {
  const req = await fetchApi(`/gastos/solicitudes/${id}`)

  if (req.status === 404) notFound()
  if (!req.ok) throw new Error(`No se pudo cargar el gasto ${id}`)

  return GastoDetalleSchema.parse(await req.json())
}

// Todo lo que necesita el formulario de crear/editar
export const obtenerDatosFormulario = async () => {
  const [catalogos, operaciones, tramitadores, bolsas, tasas] = await Promise.all([
    obtenerCatalogos(),
    obtenerOperaciones(),
    obtenerTramitadores(),
    obtenerBolsasActivas(),
    obtenerTasas()
  ])

  // Porcentaje de retención por defecto para los gastos de inmueble (0.11 → 11)
  const porcentajeRetencion = Math.round(tasas.retencion * 1e6) / 1e4

  return { catalogos, operaciones, tramitadores, bolsas, porcentajeRetencion }
}
