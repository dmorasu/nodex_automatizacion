'use client'

import { useEffect, useState } from 'react'

export function useTiposRechazo() {

  const [data, setData] = useState<{ id: number, nombre: string }[]>([])

  useEffect(() => {
    fetch(`/api/backend/tiposRechazo`)
      .then(res => res.json())
      .then(setData)
  }, [])

  return { data }
}