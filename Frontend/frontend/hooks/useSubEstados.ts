'use client'

import { useEffect, useState } from 'react'

interface SubEstado {
  id:number
  nombre:string
}

export function useSubEstados(
  tramiteId:number
) {

  const [data,setData] = useState<SubEstado[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(() => {

    if(!tramiteId){
      setData([])
      return
    }

    setLoading(true)

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/subEstados/${tramiteId}`
    )
      .then(res => res.json())
      .then(data => {
        setData(Array.isArray(data) ? data : [])
      })
      .catch(error => {
        console.error(error)
        setData([])
      })
      .finally(() => setLoading(false))

  },[tramiteId])

  return {
    data,
    loading
  }
}