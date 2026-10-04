import "server-only"
import { notFound } from "next/navigation"
import { fetchApi } from "./api"
import { CuentaDetalleSchema, ListadoCuentasSchema, ListadoReintegrosSchema } from "../schemas/gastos"

export const obtenerCuentas = async (filtros: { estado?: string, busqueda?: string, pagina?: number, tamano?: number }) => {
  const consulta = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v).map(([k, v]) => [k, String(v)])
  )
  return ListadoCuentasSchema.parse(await (await fetchApi(`/gastos/cuentas-cobro?${consulta}`)).json())
}

export const obtenerCuenta = async (id: number) => {
  const req = await fetchApi(`/gastos/cuentas-cobro/${id}`)
  if (req.status === 404) notFound()
  return CuentaDetalleSchema.parse(await req.json())
}

export const obtenerReintegros = async (estado: string | undefined, pagina: number) => {
  const consulta = new URLSearchParams({ pagina: String(pagina) })
  if (estado) consulta.set("estado", estado)
  return ListadoReintegrosSchema.parse(await (await fetchApi(`/gastos/reintegros?${consulta}`)).json())
}
