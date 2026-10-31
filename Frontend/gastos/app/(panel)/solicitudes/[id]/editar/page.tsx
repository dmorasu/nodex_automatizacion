import { redirect } from "next/navigation"
import FormularioGasto from "@/components/gastos/FormularioGasto"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerDatosFormulario, obtenerGasto } from "@/src/lib/datosGastos"

export default async function EditarGastoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  await requiereAcceso([])

  const [gasto, datosFormulario] = await Promise.all([
    obtenerGasto(Number(params.id)),
    obtenerDatosFormulario()
  ])

  // En Solicitado lo edita el creador (o el admin); después, solo el Administrador de Gastos (con motivo)
  if (!gasto.permisos.editar) redirect(`/solicitudes/${gasto.id}`)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Editar gasto {gasto.codigo}</h1>
      </div>

      <FormularioGasto
        {...datosFormulario}
        gasto={gasto}
        edicionAdmin={gasto.permisos.edicionAdmin ?? false}
        anticipo={gasto.anticipo ? {
          id: gasto.anticipo.id,
          codigo: gasto.anticipo.codigo,
          tipo: gasto.anticipo.tipo,
          concepto: gasto.conceptoPago,
          placa: gasto.placa,
          matriculaInmobiliaria: gasto.matriculaInmobiliaria,
          operacionId: gasto.operacionId,
          bolsa: gasto.bolsa ?? { id: gasto.bolsaId ?? 0, nombre: "" },
          cliente: { nombre: gasto.anticipo.cliente.nombre, identificacion: gasto.anticipo.cliente.identificacion },
          // Lo que le queda al cliente sin contar este gasto (que ya está en "por pagar")
          disponible: (gasto.saldoAnticipo?.disponible ?? 0) + Number(gasto.valorSolicitadoPago)
        } : undefined}
      />
    </div>
  )
}
