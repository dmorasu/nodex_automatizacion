"use client"

import { Slide, ToastContainer, type CloseButtonProps, type TypeOptions } from "react-toastify"
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle, type LucideIcon } from "lucide-react"
import "react-toastify/ReactToastify.css"

// Ícono y color de cada tipo de aviso (las clases van completas para que Tailwind las genere)
const ASPECTO: Record<TypeOptions, { Icono: LucideIcon, circulo: string }> = {
  success: { Icono: CheckCircle2, circulo: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  error: { Icono: XCircle, circulo: "bg-red-50 text-red-600 ring-red-100" },
  warning: { Icono: AlertTriangle, circulo: "bg-amber-50 text-amber-600 ring-amber-100" },
  info: { Icono: Info, circulo: "bg-indigo-50 text-indigo-600 ring-indigo-100" },
  default: { Icono: Info, circulo: "bg-slate-100 text-slate-500 ring-slate-200" }
}

function Icono({ type, isLoading }: { type: TypeOptions, isLoading?: boolean }) {
  if (isLoading) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-4 ring-slate-50">
        <Loader2 size={18} className="animate-spin" />
      </span>
    )
  }
  const { Icono: Simbolo, circulo } = ASPECTO[type] ?? ASPECTO.default
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-full ring-4 ${circulo}`}>
      <Simbolo size={19} strokeWidth={2.25} />
    </span>
  )
}

// Botón de 32 px: fácil de tocar con el dedo
function Cerrar({ closeToast }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={closeToast}
      className="-my-1 -mr-1 ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 active:bg-slate-100 active:text-slate-500"
      aria-label="Cerrar aviso"
    >
      <X size={16} />
    </button>
  )
}

// Avisos de la app (pensados para el celular): bajan desde arriba, ocupan el ancho con margen,
// respetan la zona de la cámara y se descartan deslizándolos hacia un lado. Estilo en globals.css (.aviso-nodex)
export default function Notificaciones() {
  return (
    <ToastContainer
      position="top-center"
      // Pasan rápido; si se tocan y se dejan presionados, se quedan
      autoClose={2500}
      newestOnTop
      limit={3}
      transition={Slide}
      pauseOnFocusLoss={false}
      draggable
      draggablePercent={35}
      icon={({ type, isLoading }) => <Icono type={type} isLoading={isLoading} />}
      closeButton={Cerrar}
      toastClassName={contexto => `${contexto?.defaultClassName ?? ""} aviso-nodex aviso-nodex--${contexto?.type ?? "default"}`}
    />
  )
}
