"use server"

import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado = { ok: true } | { ok: false, errores: string[] }

const enviar = async (metodo: "POST" | "DELETE", ruta: string, cuerpo: object = {}): Promise<Resultado> => {
  const req = await fetchApi(ruta, { method: metodo, body: JSON.stringify(cuerpo) })
  return req.ok ? { ok: true } : { ok: false, errores: await leerErrores(req) }
}

type Suscripcion = { endpoint: string, keys: { p256dh: string, auth: string } }

// Guarda el celular para recibir avisos (trámites nuevos y reintegros pendientes)
export const guardarSuscripcionPush = async (suscripcion: Suscripcion, navegador: string) =>
  enviar("POST", "/notificaciones/suscripcion", { endpoint: suscripcion.endpoint, keys: suscripcion.keys, navegador })

export const quitarSuscripcionPush = async (endpoint: string) =>
  enviar("DELETE", "/notificaciones/suscripcion", { endpoint })

export const enviarPruebaPush = async () => enviar("POST", "/notificaciones/prueba")
