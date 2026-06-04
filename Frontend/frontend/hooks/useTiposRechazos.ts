'use client'

import { useEffect, useState } from 'react'

export function useTiposRechazo() {

  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/tiposRechazo`)
      .then(res => res.json())
      .then(setData)
  }, [])

  return { data }
}