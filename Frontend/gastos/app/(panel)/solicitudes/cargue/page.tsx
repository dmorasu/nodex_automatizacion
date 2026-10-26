import CargueMasivoGastos from "@/components/gastos/CargueMasivoGastos"
import { requiereAcceso } from "@/src/auth/dal"

// Mismo cargue de Nodex Trámites: como "Nuevo gasto", para cualquier usuario
export default async function CargueGastosPage() {
  await requiereAcceso([])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Cargue masivo de gastos</h1>
      </div>

      <CargueMasivoGastos />
    </div>
  )
}
