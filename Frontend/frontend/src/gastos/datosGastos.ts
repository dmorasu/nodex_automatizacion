import "server-only"

// Lecturas de la API de Nodex Gastos para el detalle del trámite.
// Si algo falla se devuelve vacío: la pestaña de gastos no debe romper el detalle del trámite.

export type GastoTramite = {
  id: number
  codigo: string
  conceptoPago: string
  valorSolicitadoPago: string
  valorRealmentePagado: string | null
  fechaPago: string | null
  numeroEgreso: string | null
  createdAt: string
  estado: { codigo: string, nombre: string }
  tipoGasto: { nombre: string }
  bolsa: { nombre: string } | null
  beneficiario: { nombre: string, identificacion: string }
  creador: { nombreUsuario: string } | null
  factura: { numeroFactura: string | null, valorFactura: string, valorLegalizado: string } | null
  reintegros: { id: number, valorReintegro: string, estado: { codigo: string, nombre: string } }[]
}

export type OpcionesGasto = {
  bolsas: { id: number, nombre: string, lineaNegocio: string | null }[]
  tiposGasto: { id: number, codigo: string, nombre: string }[]
  formasPago: { id: number, codigo: string, nombre: string }[]
  // Tipos de documento que se pueden subir al crear el gasto (los de pago, en Catálogos de Gastos)
  tiposDocumentoPago: { id: number, nombre: string }[]
  // Porcentaje de retención por defecto para gastos de inmueble (ej: 11)
  porcentajeRetencion: number
}

const leer = async <T>(ruta: string, token: string, vacio: T): Promise<T> => {
  try {
    const req = await fetch(`${process.env.API_URL}${ruta}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    })
    return req.ok ? await req.json() : vacio
  } catch {
    return vacio
  }
}

export const obtenerGastosDeTramite = (tramiteId: number, token: string) =>
  leer<GastoTramite[]>(`/gastos/tramites/${tramiteId}/gastos`, token, [])

// Bolsas activas y catálogos para el formulario de crear gasto
export const obtenerOpcionesGasto = async (token: string): Promise<OpcionesGasto> => {
  const [bolsas, catalogos, parametros] = await Promise.all([
    leer<OpcionesGasto["bolsas"]>("/gastos/apoyo/bolsas", token, []),
    leer<{
      tiposGasto: OpcionesGasto["tiposGasto"]
      formasPago: OpcionesGasto["formasPago"]
      tiposDocumento: { id: number, nombre: string, paraPago?: boolean }[]
    }>("/gastos/catalogos", token, { tiposGasto: [], formasPago: [], tiposDocumento: [] }),
    leer<{ clave: string, valor: string }[]>("/gastos/parametros", token, [])
  ])

  // 0.11 → 11 (si no se puede leer, 11 %)
  const retencion = parametros.find(p => p.clave === "RETENCION_FUENTE")
  const porcentajeRetencion = retencion ? Math.round(Number(retencion.valor) * 1e6) / 1e4 : 11

  return {
    bolsas,
    tiposGasto: catalogos.tiposGasto,
    formasPago: catalogos.formasPago,
    tiposDocumentoPago: (catalogos.tiposDocumento ?? []).filter(t => t.paraPago).map(({ id, nombre }) => ({ id, nombre })),
    porcentajeRetencion
  }
}
