'use client'

import { useEffect, useState } from 'react'

export function useTransportadoras() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/backend/transportadoras`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
