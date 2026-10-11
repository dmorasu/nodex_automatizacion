import "server-only"
import { z } from "zod"
import { notFound } from "next/navigation"
import { fetchApi } from "./api"
import {
  HistorialCajaSchema,
  ListadoGastosSchema,
  ListadoReembolsosSchema,
  ReembolsoDetalleSchema,
  ResumenCajaSchema,
  UsuariosCajaSchema
} from "../schemas/gastos"

// Cajas que ve el usuario (Tesorería todas; la auxiliar, la suya) con su saldo y cuadre
export const obtenerCajas = async () => {
  const req = await fetchApi("/gastos/caja-menor/cajas")
  if (!req.ok) throw new Error("No se pudieron cargar las cajas menores")
  return z.array(ResumenCajaSchema).parse(await req.json())
}

// Gastos de una caja en un estado (el backend limita a la auxiliar a su caja)
export const obtenerGastosCaja = async (bolsaId: number, estado: string) => {
  const params = new URLSearchParams({ alcance: "todos", cajaMenor: "si", bolsaId: String(bolsaId), estado, tamano: "100", orden: "antiguos" })
  const req = await fetchApi(`/gastos/solicitudes?${params}`)
  if (!req.ok) throw new Error("No se pudieron cargar los gastos de la caja")
  return ListadoGastosSchema.parse(await req.json())
}

export const obtenerReembolsos = async (filtros: { bolsaId?: number, estado?: string, pagina?: number }) => {
  const params = new URLSearchParams()
  if (filtros.bolsaId) params.set("bolsaId", String(filtros.bolsaId))
  if (filtros.estado) params.set("estado", filtros.estado)
  if (filtros.pagina) params.set("pagina", String(filtros.pagina))
  const req = await fetchApi(`/gastos/caja-menor/reembolsos?${params}`)
  if (!req.ok) throw new Error("No se pudieron cargar los reembolsos")
  return ListadoReembolsosSchema.parse(await req.json())
}

export const obtenerReembolso = async (id: number) => {
  const req = await fetchApi(`/gastos/caja-menor/reembolsos/${id}`)
  if (req.status === 404 || req.status === 403) notFound()
  if (!req.ok) throw new Error(`No se pudo cargar el reembolso ${id}`)
  return ReembolsoDetalleSchema.parse(await req.json())
}

export const obtenerUsuariosCaja = async () => {
  const req = await fetchApi("/gastos/caja-menor/usuarios")
  if (!req.ok) throw new Error("No se pudieron cargar los usuarios")
  return UsuariosCajaSchema.parse(await req.json())
}

export type FiltrosHistorialCaja = { estado?: string, desde?: string, hasta?: string, quienLegaliza?: string, busqueda?: string, pagina?: string }

export const obtenerHistorialCaja = async (bolsaId: number, filtros: FiltrosHistorialCaja) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][])
  const req = await fetchApi(`/gastos/caja-menor/cajas/${bolsaId}/historial?${params}`)
  if (!req.ok) throw new Error("No se pudo cargar el historial de la caja")
  return HistorialCajaSchema.parse(await req.json())
}
