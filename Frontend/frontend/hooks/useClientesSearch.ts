'use client'

import { useEffect, useState } from 'react'

export function useClientesSearch() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (search.length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/backend/clientes/search?search=${search}&limit=25`,
          { signal: controller.signal }
        )
        const data = await res.json()
        setResults(data)
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [search])

  return { search, setSearch, results, loading }
}