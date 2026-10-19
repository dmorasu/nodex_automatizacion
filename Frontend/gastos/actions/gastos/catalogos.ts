"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

const enviar = async (ruta: string, metodo: "POST" | "PUT" | "DELETE", cuerpo?: object): Promise<Resultado> => {
  const req = await fetchApi(`/gastos/admin/catalogos/${ruta}`, { method: metodo, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/catalogos", "layout")
  return { ok: true }
}

type DatosRegistro = { nombre?: string, activo?: boolean, paraPago?: boolean, paraLegalizacion?: boolean, paraReintegro?: boolean }

// Crea (sin id) o renombra / activa / desactiva / cambia los usos (con id) un registro del catálogo
export async function guardarEnCatalogo(catalogo: string, datos: DatosRegistro, id?: number) {
  return enviar(id ? `${catalogo}/${id}` : catalogo, id ? "PUT" : "POST", datos)
}

// Solo lo que no está en uso
export async function eliminarDeCatalogo(catalogo: string, id: number) {
  return enviar(`${catalogo}/${id}`, "DELETE")
}
