import { AsyncLocalStorage } from 'async_hooks'

// =====================================
// QUIÉN HACE LA PETICIÓN, DISPONIBLE EN CUALQUIER PUNTO DEL CÓDIGO
// Los hooks de los modelos (historial del trámite) no reciben `req`. En vez de pasar el
// usuario por cada controlador y servicio, la autenticación lo deja aquí y todo lo que se
// ejecute dentro de esa petición lo puede leer.
// =====================================

// WEB = Nodex Trámites; MASIVO = gestión masiva / cargues de Excel; APP_TRAMITADOR = app
// del tramitador. Sin contexto (tareas programadas, scripts) = SISTEMA.
export type OrigenCambio = 'WEB' | 'MASIVO' | 'APP_TRAMITADOR' | 'SISTEMA'

export type ContextoPeticion = {
  usuarioId: number | null
  tramitadorId: number | null
  nombre: string
  origen: OrigenCambio
}

const almacen = new AsyncLocalStorage<ContextoPeticion>()

export const ejecutarConContexto = (contexto: ContextoPeticion, fn: () => void) => almacen.run(contexto, fn)

export const contextoActual = (): ContextoPeticion =>
  almacen.getStore() ?? { usuarioId: null, tramitadorId: null, nombre: 'Sistema', origen: 'SISTEMA' }

// Cargues por Excel y gestión masiva en pantalla
export const origenDeRuta = (url: string): OrigenCambio =>
  url.startsWith('/api/bulk/') || url.includes('/carga-masiva') || url.includes('/cargue/') ? 'MASIVO' : 'WEB'
