'use client'

import { useEffect, useState } from 'react'

export function useTramites() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/backend/tramites`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
