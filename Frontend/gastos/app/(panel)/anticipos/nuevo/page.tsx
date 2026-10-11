import FormularioAnticipo from "@/components/anticipos/FormularioAnticipo"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerDatosFormularioAnticipo } from "@/src/lib/datosAnticipos"

// ?clase=FACTURA abre el formulario en solicitud de factura (se puede cambiar antes de guardar)
export default async function NuevoAnticipoPage({ searchParams }: { searchParams: { clase?: string } }) {
  await requiereAcceso([])
  const datos = await obtenerDatosFormularioAnticipo()
  const clase = searchParams.clase === "FACTURA" ? "FACTURA" : "ANTICIPO"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Nuevo anticipo o solicitud de factura</h1>
      </div>

      <FormularioAnticipo {...datos} claseInicial={clase} />
    </div>
  )
}
