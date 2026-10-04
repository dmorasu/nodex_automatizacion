'use client'

import { useEffect, useState } from 'react'

export function useTramitadores() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/backend/tramitador/tramitadores`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
