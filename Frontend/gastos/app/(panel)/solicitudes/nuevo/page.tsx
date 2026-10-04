import FormularioGasto from "@/components/gastos/FormularioGasto"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerDatosFormulario } from "@/src/lib/datosGastos"

export default async function NuevoGastoPage() {
  await requiereAcceso([])
  const datosFormulario = await obtenerDatosFormulario()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Nuevo gasto</h1>
        <p className="mt-1 text-sm text-slate-400">
          La solicitud queda en estado Solicitado hasta que Tesorería la pague.
        </p>
      </div>

      <FormularioGasto {...datosFormulario} />
    </div>
  )
}
