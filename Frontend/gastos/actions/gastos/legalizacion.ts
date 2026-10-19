"use server"

import { revalidatePath } from "next/cache"
import { fetchApi, leerErrores } from "@/src/lib/api"

type Resultado<T = undefined> =
  | { ok: true, datos: T, advertencia?: string }
  | { ok: false, errores: string[] }

export type DatosCuenta = {
  numeroCuentaCobro: string
  fechaRadicacion: string
  observacion: string
}

export type DatosFactura = {
  numeroFactura: string
  tieneFacturaReal: boolean
  identificacionTerceroReal: string
  nombreTerceroReal: string
  valorFactura: number
  observacion: string
}

const refrescar = () => {
  revalidatePath("/legalizacion", "layout")
  revalidatePath("/tesoreria", "layout")
  revalidatePath("/solicitudes", "layout")
}

// Envía la petición y convierte la respuesta en Resultado
const ejecutar = async <T = undefined>(ruta: string, metodo: string, cuerpo?: unknown): Promise<Resultado<T>> => {
  const req = await fetchApi(ruta, {
    method: metodo,
    ...(cuerpo !== undefined && { body: cuerpo instanceof FormData ? cuerpo : JSON.stringify(cuerpo) })
  })

  if (!req.ok) return { ok: false, errores: await leerErrores(req) }

  refrescar()
  return { ok: true, datos: await req.json() as T }
}

// ── Cuentas de cobro ───────────────────────

export const crearCuenta = async (datos: DatosCuenta) =>
  ejecutar<{ id: number }>("/gastos/cuentas-cobro", "POST", datos)

export const actualizarCuenta = async (id: number, datos: DatosCuenta) =>
  ejecutar(`/gastos/cuentas-cobro/${id}`, "PUT", datos)

export const agregarGastosACuenta = async (cuentaId: number, gastoIds: number[]) =>
  ejecutar(`/gastos/cuentas-cobro/${cuentaId}/gastos`, "POST", { gastoIds })

export const quitarLinea = async (cuentaId: number, lineaId: number) =>
  ejecutar(`/gastos/cuentas-cobro/${cuentaId}/gastos/${lineaId}`, "DELETE")

export const legalizarCuenta = async (cuentaId: number, fechaRadicacion: string) =>
  ejecutar(`/gastos/cuentas-cobro/${cuentaId}/legalizar`, "POST", { fechaRadicacion })

export const anularCuenta = async (cuentaId: number, motivo: string) =>
  ejecutar(`/gastos/cuentas-cobro/${cuentaId}/anular`, "POST", { motivo })

export const subirDocumentosCuenta = async (cuentaId: number, archivos: FormData) =>
  ejecutar(`/gastos/cuentas-cobro/${cuentaId}/documentos`, "POST", archivos)

export const eliminarDocumentoLegalizacion = async (documentoId: number) =>
  ejecutar(`/gastos/documentos/${documentoId}`, "DELETE")

// ── Factura real ───────────────────────────

// Registra o corrige la factura; si se adjunta el archivo, se sube como documento del gasto.
// Devuelve la diferencia pagado − factura (reintegro si es positiva).
export async function registrarFactura(
  gastoId: number,
  datos: DatosFactura,
  archivo: FormData | null
): Promise<Resultado<{ diferencia: number }>> {
  const resultado = await ejecutar<{ diferencia: number }>(`/gastos/solicitudes/${gastoId}/factura`, "PUT", datos)
  if (!resultado.ok || !archivo || archivo.getAll("archivos").length === 0) return resultado

  const subida = await ejecutar(`/gastos/solicitudes/${gastoId}/documentos`, "POST", archivo)

  return subida.ok
    ? resultado
    : { ...resultado, advertencia: `La factura quedó registrada, pero el archivo no se pudo subir: ${subida.errores[0]}` }
}

// ── Soportes de los tramitadores (app Nodex Tramitadores) ──

// Aprueba el soporte: sus archivos pasan al gasto. Un comprobante de reintegro
// además marca el reintegro como recibido en la fecha indicada (vuelve a la bolsa).
export const aprobarSoporte = async (soporteId: number, fechaReintegro: string | null) =>
  ejecutar<string>(`/gastos/soportes-tramitador/${soporteId}/aprobar`, "POST", { fechaReintegro })

export const rechazarSoporte = async (soporteId: number, motivo: string) =>
  ejecutar<string>(`/gastos/soportes-tramitador/${soporteId}/rechazar`, "POST", { motivo })

// ── Reintegros ─────────────────────────────

// Los reintegros se crean solos al registrar la factura; aquí se marcan como recibidos
export async function marcarReintegrado(reintegroId: number, fechaReintegro: string, soporte: FormData | null): Promise<Resultado> {
  const resultado = await ejecutar(`/gastos/reintegros/${reintegroId}/reintegrar`, "POST", { fechaReintegro })
  if (!resultado.ok || !soporte || soporte.getAll("archivos").length === 0) return resultado

  const subida = await ejecutar(`/gastos/reintegros/${reintegroId}/documentos`, "POST", soporte)

  return subida.ok
    ? resultado
    : { ...resultado, advertencia: `El reintegro quedó registrado, pero el soporte no se pudo subir: ${subida.errores[0]}` }
}

// ── PDF de pago unificado (operaciones como la 1301) ──

export type SegundoDocumento = "SOPORTE" | "FACTURA" | "AMBOS"
export type DocumentoRevision = { id: number, nombre: string, tipo: string }
export type RevisionPdfPago = {
  id: number
  codigo: string
  archivo: string
  liquidaciones: DocumentoRevision[]
  soportes: DocumentoRevision[]
  facturas: DocumentoRevision[]
  sugerido: SegundoDocumento
}

// Antes de descargar: qué gastos bajan como un solo PDF de pago, qué documentos tiene cada uno
// y qué se sugiere poner después de la liquidación (vacío si ninguno lo lleva)
export async function revisarPdfsDePago(gastoIds: number[]): Promise<Resultado<RevisionPdfPago[]>> {
  const req = await fetchApi("/gastos/documentos/descargar/revision", { method: "POST", body: JSON.stringify({ gastoIds }) })
  if (!req.ok) return { ok: false, errores: await leerErrores(req) }
  return { ok: true, datos: await req.json() }
}
