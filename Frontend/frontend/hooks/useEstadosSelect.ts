'use client'
import { useEffect, useState } from 'react'

export function useEstados() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetch(`/api/backend/estados`)
      .then(res => res.json())
      .then(setData)
  }, [])

  return { data }
}
