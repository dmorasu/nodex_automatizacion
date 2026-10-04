// Clases de Tailwind reutilizadas en formularios y botones del módulo

export const claseInput = `
  w-full h-10 px-3 rounded-md border border-slate-200 bg-white
  text-xs text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100
  disabled:bg-slate-50 disabled:text-slate-400
`

export const claseTextarea = `
  w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white resize-y
  text-xs text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100
`

export const claseLabel = "block mb-1.5 text-xs font-medium text-slate-600"

export const claseBotonPrimario = `
  inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md shadow-sm
  bg-emerald-600 text-white text-xs font-semibold transition
  hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
`

export const claseBotonSecundario = `
  inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md
  border border-slate-200 bg-white text-slate-600 text-xs font-semibold transition
  hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed
`

export const claseBotonPeligro = `
  inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md
  border border-red-200 bg-white text-red-600 text-xs font-semibold transition
  hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed
`
