import ListaCuentasCobro from "@/components/legalizacion/ListaCuentasCobro"

export default async function CuentasCobroPage(
  props: { searchParams: Promise<{ estado?: string, busqueda?: string, pagina?: string }> }
) {
  const searchParams = await props.searchParams
  return <ListaCuentasCobro searchParams={searchParams} rutaBase="/contabilidad/cuentas" />
}
