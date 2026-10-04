"use client"

import { createContext, useContext } from "react"
import type { PerfilTramites, PermisosAnalistas } from "./perfiles"

// Perfil del usuario disponible en cualquier componente de cliente del centro
// (se carga una vez en app/center/layout.tsx)
const PerfilContexto = createContext<PerfilTramites>("TORRE_CONTROL")
const PermisosContexto = createContext<PermisosAnalistas>({ esAnalista: false, puedeAsignarAnalistas: false })

export function ProveedorPerfil({ perfil, permisos, children }: {
  perfil: PerfilTramites
  permisos: PermisosAnalistas
  children: React.ReactNode
}) {
  return (
    <PerfilContexto.Provider value={perfil}>
      <PermisosContexto.Provider value={permisos}>{children}</PermisosContexto.Provider>
    </PerfilContexto.Provider>
  )
}

export const usePerfil = () => useContext(PerfilContexto)

// ¿Es analista (ve solo sus trámites)? ¿Puede reasignar analistas?
export const usePermisosAnalistas = () => useContext(PermisosContexto)
