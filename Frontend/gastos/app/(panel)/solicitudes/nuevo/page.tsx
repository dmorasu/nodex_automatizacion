import { redirect } from "next/navigation"
import FormularioGasto, { type AnticipoDelGasto } from "@/components/gastos/FormularioGasto"
import { requiereAcceso } from "@/src/auth/dal"
import { obtenerDatosFormulario } from "@/src/lib/datosGastos"
import { obtenerAnticipo } from "@/src/lib/datosAnticipos"

// ?anticipo=<id> → gasto creado desde un anticipo confirmado (botón "Crear gasto")
export default async function NuevoGastoPage({ searchParams }: { searchParams: { anticipo?: string } }) {
  await requiereAcceso([])
  const anticipoId = Number(searchParams.anticipo) || null

  const [datosFormulario, anticipo] = await Promise.all([
    obtenerDatosFormulario(),
    anticipoId ? obtenerAnticipo(anticipoId) : Promise.resolve(null)
  ])

  if (anticipo && !anticipo.permisos.crearGasto) redirect(`/anticipos/${anticipo.id}`)

  const delAnticipo: AnticipoDelGasto | undefined = anticipo ? {
    id: anticipo.id,
    codigo: anticipo.codigo,
    tipo: anticipo.tipo,
    concepto: anticipo.concepto,
    placa: anticipo.placa,
    matriculaInmobiliaria: anticipo.matriculaInmobiliaria,
    operacionId: anticipo.operacionId,
    bolsa: anticipo.bolsa,
    cliente: { nombre: anticipo.cliente.nombre, identificacion: anticipo.cliente.identificacion },
    disponible: anticipo.saldoCliente?.disponible ?? Number(anticipo.valorRecibido ?? 0)
  } : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{anticipo ? `Nuevo gasto del anticipo ${anticipo.codigo}` : "Nuevo gasto"}</h1>
      </div>

      <FormularioGasto {...datosFormulario} anticipo={delAnticipo} />
    </div>
  )
}
