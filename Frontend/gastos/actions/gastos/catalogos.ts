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

// Hora de corte de la programación de pagos ("09:30" → 9.5 horas, como la guarda el backend)
export async function guardarHoraCorte(hora: string): Promise<Resultado> {
  const [h, m] = hora.split(":").map(Number)
  const req = await fetchApi("/gastos/admin/parametros/HORA_CORTE_PROGRAMACION", { method: "PUT", body: JSON.stringify({ valor: h + m / 60 }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  revalidatePath("/catalogos/programacion")
  return { ok: true }
}

// Solo lo que no está en uso
export async function eliminarDeCatalogo(catalogo: string, id: number) {
  return enviar(`${catalogo}/${id}`, "DELETE")
}
