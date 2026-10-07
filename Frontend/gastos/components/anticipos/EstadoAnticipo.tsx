import { ESTADOS_ANTICIPO } from "@/src/schemas/gastos"

export default function EstadoAnticipo({ estado }: { estado: string }) {
  const { nombre, clase } = ESTADOS_ANTICIPO[estado] ?? { nombre: estado, clase: "border-slate-200 bg-slate-50 text-slate-500" }
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${clase}`}>{nombre}</span>
}
