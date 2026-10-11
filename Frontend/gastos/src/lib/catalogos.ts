import "server-only"
import { notFound } from "next/navigation"
import { fetchApi } from "./api"
import { CatalogoAdminSchema } from "../schemas/admin"

// Pestañas de Catálogos: ruta → catálogo del backend (/gastos/admin/catalogos/:catalogo)
export const CATALOGOS = [
  { ruta: "", catalogo: "clientesEmpresariales", nombre: "Clientes empresariales", nuevo: "Nuevo cliente empresarial", uso: ["anticipo", "anticipos"] },
  { ruta: "tipos-gasto", catalogo: "tiposGasto", nombre: "Tipos de gasto", nuevo: "", uso: ["gasto", "gastos"] },
  { ruta: "formas-pago", catalogo: "formasPago", nombre: "Formas de pago", nuevo: "Nueva forma de pago", uso: ["gasto", "gastos"] },
  { ruta: "tipos-documento", catalogo: "tiposDocumento", nombre: "Tipos de documento", nuevo: "Nuevo tipo de documento", uso: ["documento", "documentos"] }
] as const

export type PestanaCatalogo = typeof CATALOGOS[number]

export const obtenerCatalogo = async (ruta: string) => {
  const pestana = CATALOGOS.find(c => c.ruta === ruta)
  if (!pestana) notFound()
  const req = await fetchApi(`/gastos/admin/catalogos/${pestana.catalogo}`)
  if (!req.ok) throw new Error(`No se pudo cargar ${pestana.nombre}`)
  return { pestana, ...CatalogoAdminSchema.parse(await req.json()) }
}
