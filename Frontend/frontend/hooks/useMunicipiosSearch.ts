'use client'

import { useEffect, useState } from 'react'

interface Municipio {
  id: number
  nombreMunicipio: string
  departamento: string
  regional: string
}

export function useMunicipiosSearch() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Municipio[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (search.length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()

    const delay = setTimeout(async () => {
      try {
        setLoading(true)

        const res = await fetch(
          `/api/backend/municipios/search?search=${search}&limit=20`,
          { signal: controller.signal }
        )

        const data: Municipio[] = await res.json()
        setResults(data)

      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(delay)
    }
  }, [search])

  return {
    search,
    setSearch,
    results,
    loading
  }
}
