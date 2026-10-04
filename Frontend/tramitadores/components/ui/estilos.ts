// Clases de Tailwind reutilizadas. Pensadas para el dedo: controles de mínimo 44 px de alto.
// Los campos usan letra de 16 px en el celular: con menos, el iPhone hace zoom al tocarlos
// y la página queda corrida hacia un lado.

export const claseInput = `
  w-full min-w-0 h-11 px-3 rounded-lg border border-slate-200 bg-white
  text-base sm:text-sm text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
`

export const claseTextarea = `
  w-full min-w-0 px-3 py-2.5 rounded-lg border border-slate-200 bg-white resize-y
  text-base sm:text-sm text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
`

export const claseSelect = `
  w-full min-w-0 h-11 px-3 rounded-lg border border-slate-200 bg-white
  text-base sm:text-sm text-slate-700 outline-none
  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
`

export const claseLabel = "block mb-1.5 text-xs font-semibold text-slate-600"

export const claseBotonPrimario = `
  inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg shadow-sm
  bg-indigo-600 text-white text-sm font-semibold text-center transition
  active:bg-indigo-800 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
`

export const claseBotonSecundario = `
  inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg
  border border-slate-200 bg-white text-slate-600 text-sm font-semibold text-center transition
  active:bg-slate-100 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed
`

export const claseTarjeta = "rounded-xl border border-slate-200 bg-white shadow-sm"
