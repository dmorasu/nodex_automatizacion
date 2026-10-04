"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

// Acciones para crear gastos desde un trámite. Usan la API de Nodex Gastos
// (mismo backend) con el token de la sesión: el gasto queda en Nodex Gastos
// para que Tesorería lo pague, sin cambiar de plataforma.

type Resultado<T = undefined> =
  | { ok: true, datos: T }
  | { ok: false, errores: string[] }

export type TerceroGasto = {
  id: number
  tipoIdentificacion: string
  identificacion: string
  nombre: string
  banco: string | null
  tipoCuenta: string | null
  numeroCuenta: string | null
}

export type DatosGastoTramite = {
  solicitudTramiteId: number
  operacionId: number
  bolsaId: number
  tipoGastoId: number
  formaPagoId: number
  conceptoPago: string
  valorSolicitado: number
  // Solo inmuebles (null en los demás tipos)
  baseRetencion: number | null
  porcentajeRetencion: number | null
  placa: string
  transito: string
  matriculaInmobiliaria: string
  reembolsable: boolean
  observacion: string
  beneficiarioId: number | null
  beneficiario: {
    tipoIdentificacion: string
    identificacion: string
    nombre: string
    banco: string
    tipoCuenta: string
    numeroCuenta: string
  } | null
}

const llamarApi = (ruta: string, opciones: RequestInit = {}) =>
  fetch(`${process.env.API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cookies().get("TOKEN")?.value}`
    },
    cache: "no-store"
  })

// { error } (reglas de negocio) o { errors: [{ msg }] } (validaciones)
const leerErrores = async (respuesta: Response) => {
  const json = await respuesta.json().catch(() => null)
  if (json?.error) return [json.error as string]
  if (Array.isArray(json?.errors)) return json.errors.map((e: { msg: string }) => e.msg) as string[]
  return ["No se pudo completar la operación"]
}

export async function crearGastoDesdeTramite(datos: DatosGastoTramite): Promise<Resultado<{ id: number, codigo: string }>> {
  const req = await llamarApi("/gastos/solicitudes", { method: "POST", body: JSON.stringify(datos) })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  revalidatePath(`/center/solicitudTramites/${datos.solicitudTramiteId}`)
  return { ok: true, datos: await req.json() }
}

export async function buscarTercerosGasto(busqueda: string): Promise<TerceroGasto[]> {
  if (busqueda.trim().length < 3) return []

  const req = await llamarApi(`/gastos/terceros?busqueda=${encodeURIComponent(busqueda.trim())}`)
  return req.ok ? req.json() : []
}
