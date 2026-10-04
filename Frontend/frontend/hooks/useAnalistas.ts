'use client'

import { useEffect, useState } from 'react'

export type Analista = { id: number, nombreUsuario: string, correoUsuario: string }

// Usuarios con el rol Analista de trámites
export function useAnalistas() {
  const [data, setData] = useState<Analista[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/backend/solicitudTramites/analistas`)
      .then(res => (res.ok ? res.json() : []))
      .then(datos => setData(Array.isArray(datos) ? datos : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
