// Un color por mensajero, en el orden de la agenda (idea del prototipo CalendarioNodex). Clases
// completas escritas aquí (Tailwind lee components/, no src/) para que se generen.
export type ColorMensajero = { fondo: string, franja: string, cita: string, numero: string, barra: string }
const COLORES: ColorMensajero[] = [
  { fondo: "bg-sky-600", franja: "bg-sky-600", cita: "border-sky-200 bg-sky-50 text-sky-900", numero: "text-sky-700", barra: "bg-sky-500" },
  { fondo: "bg-indigo-600", franja: "bg-indigo-600", cita: "border-indigo-200 bg-indigo-50 text-indigo-900", numero: "text-indigo-700", barra: "bg-indigo-500" },
  { fondo: "bg-teal-600", franja: "bg-teal-600", cita: "border-teal-200 bg-teal-50 text-teal-900", numero: "text-teal-700", barra: "bg-teal-500" },
  { fondo: "bg-purple-600", franja: "bg-purple-600", cita: "border-purple-200 bg-purple-50 text-purple-900", numero: "text-purple-700", barra: "bg-purple-500" },
  { fondo: "bg-cyan-700", franja: "bg-cyan-700", cita: "border-cyan-200 bg-cyan-50 text-cyan-900", numero: "text-cyan-800", barra: "bg-cyan-600" },
  { fondo: "bg-fuchsia-600", franja: "bg-fuchsia-600", cita: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900", numero: "text-fuchsia-700", barra: "bg-fuchsia-500" },
  { fondo: "bg-blue-700", franja: "bg-blue-700", cita: "border-blue-200 bg-blue-50 text-blue-900", numero: "text-blue-700", barra: "bg-blue-600" },
  { fondo: "bg-emerald-700", franja: "bg-emerald-700", cita: "border-emerald-200 bg-emerald-50 text-emerald-900", numero: "text-emerald-700", barra: "bg-emerald-600" }
]
export const colorMensajero = (posicion: number) => COLORES[posicion % COLORES.length]
