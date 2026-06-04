"use client"

import { useState } from "react"
import { useSubEstados } from "@/hooks/useSubEstados"

interface Props {
  tramiteId:number
  name?:string
}

export default function SubEstadosCombobox({
  tramiteId,
  name="subEstadoId"
}:Props){

  const { data, loading } =
    useSubEstados(tramiteId)

  const [selected,setSelected] =
    useState<string>("")

  return (

    <select
      name={name}
      value={selected}
      onChange={(e)=>
        setSelected(e.target.value)
      }
      className="w-full border p-3 rounded-md"
      required
    >

      <option value="">
        {loading
          ? "Cargando..."
          : "Seleccione SubEstado"}
      </option>

      {data.map(subEstado => (

        <option
          key={subEstado.id}
          value={subEstado.id}
        >
          {subEstado.nombre}
        </option>

      ))}

    </select>
  )
}