'use client'

import { useEffect, useState } from 'react'

export function useOperaciones() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/backend/operaciones`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
