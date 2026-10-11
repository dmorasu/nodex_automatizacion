import { notFound } from "next/navigation"
import { obtenerCatalogo } from "@/src/lib/catalogos"
import AdministrarCatalogo from "@/components/catalogos/AdministrarCatalogo"

export default async function CatalogoPage({ params }: { params: { catalogo: string } }) {
  // La pestaña principal vive en /catalogos
  if (!params.catalogo) notFound()
  const { pestana, permiteCrear, registros } = await obtenerCatalogo(params.catalogo)
  return <AdministrarCatalogo catalogo={pestana.catalogo} textoNuevo={pestana.nuevo} uso={pestana.uso} permiteCrear={permiteCrear} registros={registros} />
}
