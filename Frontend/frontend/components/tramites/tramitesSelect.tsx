"use client"

import { useEffect, useState } from "react"
import {
  FileText,
  ChevronDown
} from "lucide-react"

import { TramitesSchema } from "@/src/schemas"


type Props = {
  name: string
  defaultValue?: number
}


export default function TramitesSelect({
  name,
  defaultValue
}: Props) {

  const [data, setData] = useState<
    {
      id: number
      nombreTramite: string
    }[]
  >([])

  const [selected, setSelected] =
    useState("")


  // =====================================================
  // CARGAR TRÁMITES
  // =====================================================

  useEffect(() => {

    const cargarTramites = async () => {

      try {

        const res =
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/tramites`
          )

        if (!res.ok) {
          throw new Error(
            "Error al cargar los trámites"
          )
        }

        const json =
          await res.json()

        const result =
          TramitesSchema.parse(json)

        setData(result)

      } catch (error) {

        console.error(
          "Error cargando trámites:",
          error
        )

        setData([])

      }

    }

    cargarTramites()

  }, [])



  // =====================================================
  // APLICAR VALOR POR DEFECTO
  // =====================================================

  useEffect(() => {

    if (
      defaultValue !== undefined &&
      data.length > 0
    ) {

      setSelected(
        String(defaultValue)
      )

    }

  }, [defaultValue, data])



  return (

    <div className="
      relative
      w-full
    ">


      {/* ================================================= */}
      {/* ICONO                                            */}
      {/* ================================================= */}

      <div className="
        pointer-events-none
        absolute
        left-3
        top-1/2
        -translate-y-1/2
        z-10
        flex
        items-center
        justify-center
        w-7
        h-7
        rounded-md
        bg-sky-50
        border
        border-sky-100
      ">

        <FileText
          size={14}
          className="
            text-sky-500
          "
        />

      </div>



      {/* ================================================= */}
      {/* SELECT                                           */}
      {/* ================================================= */}

      <select
        name={name}
        value={selected}
        onChange={(e) =>
          setSelected(
            e.target.value
          )
        }
        className="
          w-full
          h-10
          pl-12
          pr-10
          text-xs
          text-slate-700
          bg-white
          border
          border-slate-200
          rounded-md
          appearance-none
          outline-none
          transition
          cursor-pointer

          hover:border-sky-300

          focus:border-sky-400
          focus:ring-2
          focus:ring-sky-100
        "
      >

        <option
          value=""
          className="
            text-slate-400
          "
        >

          Seleccionar trámite...

        </option>


        {data.map(
          (tramite) => (

            <option
              key={tramite.id}
              value={tramite.id}
            >

              {tramite.nombreTramite}

            </option>

          )
        )}

      </select>



      {/* ================================================= */}
      {/* CHEVRON                                          */}
      {/* ================================================= */}

      <div className="
        pointer-events-none
        absolute
        right-3
        top-1/2
        -translate-y-1/2
      ">

        <ChevronDown
          size={15}
          className="
            text-slate-400
          "
        />

      </div>

    </div>

  )
}