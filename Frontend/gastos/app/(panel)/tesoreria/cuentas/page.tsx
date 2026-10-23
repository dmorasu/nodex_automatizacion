import { TESORERIA_OPERATIVA } from "@/src/auth/permisos"
import { requiereAcceso } from "@/src/auth/dal"
import ListaCuentasCobro from "@/components/legalizacion/ListaCuentasCobro"

export default async function CuentasCobroPage({ searchParams }: { searchParams: { estado?: string, busqueda?: string, pagina?: string } }) {
  // Solo Tesorería general (Tesorería - Certificados solo ve su bandeja y sus pagos)
  await requiereAcceso(TESORERIA_OPERATIVA)

  return <ListaCuentasCobro searchParams={searchParams} rutaBase="/tesoreria/cuentas" />
}
