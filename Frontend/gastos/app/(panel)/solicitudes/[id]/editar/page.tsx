import { redirect } from "next/navigation"
import FormularioGasto from "@/components/gastos/FormularioGasto"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerDatosFormulario, obtenerGasto } from "@/src/lib/datosGastos"

export default async function EditarGastoPage({ params }: { params: { id: string } }) {
  await requiereAcceso([])

  const [gasto, datosFormulario] = await Promise.all([
    obtenerGasto(Number(params.id)),
    obtenerDatosFormulario()
  ])

  // Solo se edita mientras está Solicitado y si es el creador (o admin)
  if (!gasto.permisos.editar) redirect(`/solicitudes/${gasto.id}`)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Editar gasto {gasto.codigo}</h1>
        <p className="mt-1 text-sm text-slate-400">Los valores se recalculan al guardar.</p>
      </div>

      <FormularioGasto {...datosFormulario} gasto={gasto} />
    </div>
  )
}
