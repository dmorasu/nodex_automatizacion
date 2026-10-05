'use client'

import { useEffect, useState } from 'react'

interface Filtros {
  search?: string
  estadoId?: string
  tramiteId?: string
  tramitadorId?: string
  analistaId?: string
  operacionesId?: string
  placa?: string
  fechaFinalizacionDesde?: string
  fechaFinalizacionHasta?: string
  page?: number
}

export function useSolicitudesFiltradas(filtros: Filtros) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setLoading(true)

    const query = new URLSearchParams()

    Object.entries(filtros).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== '' &&
        value !== null
      ) {
        query.set(key, String(value))
      }
    })

    // Pasa por la ruta interna del frontend, que agrega el token de la sesión
    // (Gestión de activos recibe solo los trámites que creó)
    fetch(`/api/backend/solicitudTramites/filtrar?${query.toString()}`)
      .then(res => res.json())
      .then(res => {
        setData(Array.isArray(res.data) ? res.data : [])
        setTotal(res.total ?? 0)
        setTotalPages(res.totalPages ?? 1)
        setCurrentPage(res.currentPage ?? 1)
      })
      .catch(error => {
        console.error('Error cargando solicitudes:', error)
        setData([])
        setTotal(0)
      })
      .finally(() => setLoading(false))

  }, [JSON.stringify(filtros)])

  return {
    data,
    loading,
    total,
    totalPages,
    currentPage
  }
}
