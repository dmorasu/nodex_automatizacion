'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { FileSpreadsheet, MousePointerClick } from 'lucide-react'
import UploadPanel from '../../../components/gestionMasiva/panel'
import GestionEnPantalla from '../../../components/gestionMasiva/GestionEnPantalla'

const tabs = [
  { key: 'estados', label: 'Estados' },
  { key: 'logistica', label: 'Logística' },
  { key: 'tramitador', label: 'Tramitador' },
  { key: 'programacion', label: 'Programación' },
  { key: 'trazabilidad', label: 'Trazabilidad' }
]

// Dos formas de hacer la misma gestión masiva (mismo proceso en el backend):
// en pantalla (eligiendo trámites y valores) o cargando la plantilla de Excel
export default function Page() {

  const [modo, setModo] = useState<'pantalla' | 'excel'>('pantalla')
  const [active, setActive] = useState('estados')

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Gestión masiva</h1>
          <p className="mt-1 text-xs text-slate-400">
            Estados, trazabilidad, programación, logística y tramitador de varios trámites a la vez.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {([
            { clave: 'pantalla', nombre: 'En pantalla', Icono: MousePointerClick },
            { clave: 'excel', nombre: 'Cargar Excel', Icono: FileSpreadsheet }
          ] as const).map(({ clave, nombre, Icono }) => (
            <button
              key={clave}
              type="button"
              onClick={() => setModo(clave)}
              className={clsx(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition',
                modo === clave ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icono size={14} />
              {nombre}
            </button>
          ))}
        </div>
      </div>

      {modo === 'pantalla' ? (
        <GestionEnPantalla />
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                  active === t.key
                    ? 'bg-sky-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <UploadPanel tipo={active} />
        </div>
      )}

    </div>
  )
}
