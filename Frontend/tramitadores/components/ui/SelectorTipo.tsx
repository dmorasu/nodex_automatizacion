"use client"

type Opcion = { codigo: string, nombre: string, ayuda: string, deshabilitada?: string | null }

// Botones grandes para elegir el tipo de documento antes de subirlo.
// Una opción deshabilitada muestra por qué no aplica.
export default function SelectorTipo({
  opciones,
  valor,
  onCambio,
  deshabilitado = false
}: {
  opciones: readonly Opcion[]
  valor: string | null
  onCambio: (codigo: string) => void
  deshabilitado?: boolean
}) {
  const elegida = opciones.find(o => o.codigo === valor)

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-slate-600">1. ¿Qué documento es? <span className="text-red-400">*</span></legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {opciones.map(o => (
          <button
            key={o.codigo}
            type="button"
            role="radio"
            aria-checked={valor === o.codigo}
            onClick={() => onCambio(o.codigo)}
            disabled={deshabilitado || Boolean(o.deshabilitada)}
            className={`min-h-12 rounded-lg border px-2 py-2 text-center text-sm font-semibold leading-tight transition disabled:opacity-40 ${valor === o.codigo ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 active:bg-slate-50"}`}
          >
            {o.nombre}
          </button>
        ))}
      </div>
      {elegida && <p className="mt-1.5 text-[11px] text-slate-400">{elegida.ayuda}</p>}
      {opciones.filter(o => o.deshabilitada).map(o => (
        <p key={o.codigo} className="mt-1 text-[11px] text-slate-400">{o.nombre}: {o.deshabilitada}</p>
      ))}
    </fieldset>
  )
}
