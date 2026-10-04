import { Metadata } from "next"
import { Wallet } from "lucide-react"
import CargueMasivoGastos from "@/components/gastos/CargueMasivoGastos"

export const metadata: Metadata = {
  title: "Nodex - Cargue masivo de gastos",
}

export default function CargueMasivoGastosPage() {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50">
          <Wallet className="text-sky-500" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Cargue masivo de gastos</h1>
          <p className="text-xs text-slate-500">
            Los gastos se crean en Nodex Gastos como Solicitados, listos para que Tesorería los pague.
            Pueden ser de sus trámites o sin trámite (ej. impuestos).
          </p>
        </div>
      </div>

      <CargueMasivoGastos />
    </div>
  )
}
