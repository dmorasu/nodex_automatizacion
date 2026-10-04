import ListaCuentasCobro from "@/components/legalizacion/ListaCuentasCobro"

export default function CuentasCobroPage({ searchParams }: { searchParams: { estado?: string, busqueda?: string, pagina?: string } }) {
  return <ListaCuentasCobro searchParams={searchParams} rutaBase="/legalizacion/cuentas" />
}
