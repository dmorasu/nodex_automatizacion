import { obtenerCatalogo } from "@/src/lib/catalogos"
import AdministrarCatalogo from "@/components/catalogos/AdministrarCatalogo"

// /catalogos = clientes empresariales; las demás pestañas en /catalogos/[catalogo]
export default async function CatalogoPrincipalPage() {
  const { pestana, permiteCrear, registros } = await obtenerCatalogo("")
  return <AdministrarCatalogo catalogo={pestana.catalogo} textoNuevo={pestana.nuevo} uso={pestana.uso} permiteCrear={permiteCrear} registros={registros} />
}
