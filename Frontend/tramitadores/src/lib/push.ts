// Notificaciones push en el navegador del celular (solo se usa en componentes "use client").
// Android: Chrome las recibe aunque la app no esté instalada. iPhone (iOS 16.4+): solo si la
// app se agregó a la pantalla de inicio y se abre desde ese ícono.

export type EstadoPush =
  | "no-soportado"     // el navegador no tiene push
  | "instalar-iphone"  // iPhone desde Safari: primero agregar a la pantalla de inicio
  | "bloqueadas"       // el tramitador las negó: solo se reactivan desde los ajustes
  | "inactivas"
  | "activas"

const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const abiertaComoApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const hayPush = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

export const registrarServiceWorker = () =>
  hayPush() ? navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null) : Promise.resolve(null)

export const suscripcionActual = async () => {
  if (!hayPush()) return null
  const registro = await navigator.serviceWorker.getRegistration("/")
  return (await registro?.pushManager.getSubscription()) ?? null
}

export const estadoPush = async (): Promise<EstadoPush> => {
  if (!hayPush()) return esIphone() && !abiertaComoApp() ? "instalar-iphone" : "no-soportado"
  if (Notification.permission === "denied") return "bloqueadas"
  if (Notification.permission === "granted" && await suscripcionActual()) return "activas"
  return "inactivas"
}

// La clave pública VAPID viene en base64url; el navegador la pide en bytes
const aBytes = (base64url: string) => {
  const base64 = (base64url + "=".repeat((4 - base64url.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

const mismaClave = (suscripcion: PushSubscription, clave: Uint8Array) => {
  const actual = suscripcion.options.applicationServerKey
  if (!actual) return false
  const bytes = new Uint8Array(actual)
  return bytes.length === clave.length && bytes.every((b, i) => b === clave[i])
}

// Pide el permiso (si hace falta) y suscribe el celular. Si la suscripción existente se hizo
// con otras claves (se cambiaron en el servidor), la rehace.
export const suscribir = async (clavePublica: string) => {
  const permiso = await Notification.requestPermission()
  if (permiso !== "granted") return null

  const registro = (await registrarServiceWorker()) ?? await navigator.serviceWorker.ready
  const clave = aBytes(clavePublica)
  const existente = await registro.pushManager.getSubscription()
  if (existente && mismaClave(existente, clave)) return existente
  if (existente) await existente.unsubscribe()

  return registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave })
}

// Datos que el backend guarda (endpoint y claves de cifrado)
export const datosSuscripcion = (suscripcion: PushSubscription) => {
  const json = suscripcion.toJSON()
  return { endpoint: json.endpoint!, keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth } }
}

export const navegadorActual = () => navigator.userAgent.slice(0, 300)
