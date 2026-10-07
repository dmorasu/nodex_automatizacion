import FormularioAnticipo from "@/components/anticipos/FormularioAnticipo"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerDatosFormularioAnticipo } from "@/src/lib/datosAnticipos"

export default async function NuevoAnticipoPage() {
  await requiereAcceso([])
  const datos = await obtenerDatosFormularioAnticipo()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Nuevo anticipo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pago de un cliente del banco. Queda por confirmar hasta que Contabilidad verifique que el dinero entró.
        </p>
      </div>

      <FormularioAnticipo {...datos} />
    </div>
  )
}
