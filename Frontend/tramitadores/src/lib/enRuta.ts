// "Ruta iniciada": el mensajero comparte su ubicación con Torre de control mientras la app
// está abierta. Se guarda en este celular y vale solo para el día en que se inició (no hay
// forma de detenerla desde la app: termina al cerrar la app o al acabar el día).
const CLAVE = "nodex-ruta-iniciada"
const CLAVE_AUTORIZACION = "nodex-ubicacion-autorizada"
const EVENTO = "nodex-ruta-iniciada"

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// localStorage puede fallar (navegación privada, datos bloqueados): sin él la ruta no queda iniciada
const leer = (clave: string) => { try { return localStorage.getItem(clave) } catch { return null } }
const escribir = (clave: string, valor: string | null) => {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, valor)
  } catch { /* sin almacenamiento */ }
}

export const rutaIniciada = () => leer(CLAVE) === hoy()
export const ubicacionAutorizada = () => leer(CLAVE_AUTORIZACION) === "si"

export const iniciarRuta = () => {
  escribir(CLAVE_AUTORIZACION, "si")
  escribir(CLAVE, hoy())
  window.dispatchEvent(new Event(EVENTO))
}

// Avisa cuando se inicia o detiene la ruta (en esta pestaña o en otra)
export const alCambiarRuta = (fn: () => void) => {
  const alAlmacenar = (e: StorageEvent) => { if (e.key === CLAVE) fn() }
  window.addEventListener(EVENTO, fn)
  window.addEventListener("storage", alAlmacenar)
  return () => {
    window.removeEventListener(EVENTO, fn)
    window.removeEventListener("storage", alAlmacenar)
  }
}
