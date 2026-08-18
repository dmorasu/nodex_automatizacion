"use client"

import { useEffect, useState } from "react"
import { Check, Search, User } from "lucide-react"


type Tramitador = {
  id: number
  nombreTramitador: string
  identificacion: string
}


type Props = {
  name: string
  defaultValue?: number
  defaultLabel?: string
}


export default function TramitadorComboBox({
  name,
  defaultValue,
  defaultLabel
}: Props) {

  const [query, setQuery] = useState("")
  const [data, setData] = useState<Tramitador[]>([])
  const [selected, setSelected] =
    useState<Tramitador | null>(null)

  const [open, setOpen] = useState(false)


  // =====================================================
  // INICIALIZAR SELECCIÓN
  // =====================================================

  useEffect(() => {

    if (
      defaultValue !== undefined &&
      defaultLabel
    ) {

      setSelected({
        id: defaultValue,
        nombreTramitador: defaultLabel,
        identificacion: ""
      })

    }

  }, [defaultValue, defaultLabel])


  // =====================================================
  // BÚSQUEDA DINÁMICA
  // =====================================================

  useEffect(() => {

    if (query.length < 2) {

      setData([])

      return
    }


    const controller =
      new AbortController()


    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/tramitador?search=${query}`,
      {
        signal: controller.signal
      }
    )
      .then(res => res.json())
      .then(setData)
      .catch(() => setData([]))


    return () =>
      controller.abort()

  }, [query])


  // =====================================================
  // SELECCIONAR TRAMITADOR
  // =====================================================

  const seleccionarTramitador = (
    tramitador: Tramitador
  ) => {

    setSelected(tramitador)

    setOpen(false)

    setQuery("")

  }


  return (

    <div className="
      relative
      w-full
    ">


      {/* ================================================= */}
      {/* INPUT DE BÚSQUEDA                                */}
      {/* ================================================= */}

      <div className="relative">


        {/* ICONO */}

        <div className="
          pointer-events-none
          absolute
          inset-y-0
          left-0
          flex
          items-center
          pl-3
        ">

          <User
            size={16}
            className="
              text-slate-400
            "
          />

        </div>


        <input
          type="text"

          className="
            w-full
            h-10
            pl-9
            pr-3
            rounded-md
            border
            border-slate-200
            bg-slate-50
            text-xs
            text-slate-700
            placeholder:text-slate-400
            outline-none
            transition
            focus:bg-white
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "

          placeholder="Buscar tramitador por nombre..."

          value={
            selected
              ? selected.nombreTramitador
              : query
          }

          onChange={(e) => {

            setQuery(e.target.value)

            setSelected(null)

            setOpen(true)

          }}

          onFocus={() => {

            if (query.length >= 2) {
              setOpen(true)
            }

          }}
        />

      </div>



      {/* ================================================= */}
      {/* INPUT OCULTO                                     */}
      {/* ================================================= */}

      <input
        type="hidden"
        name={name}
        value={selected?.id ?? ""}
      />



      {/* ================================================= */}
      {/* DROPDOWN                                         */}
      {/* ================================================= */}

      {open && data.length > 0 && (

        <ul className="
          absolute
          z-50
          mt-1
          w-full
          max-h-52
          overflow-y-auto
          rounded-lg
          border
          border-slate-200
          bg-white
          shadow-lg
          py-1
        ">


          {data.map((t) => (

            <li
              key={t.id}
              onClick={() =>
                seleccionarTramitador(t)
              }

              className="
                group
                flex
                items-center
                gap-3
                px-3
                py-2.5
                cursor-pointer
                transition-colors
                hover:bg-sky-50
              "
            >


              {/* ======================================= */}
              {/* ICONO                                   */}
              {/* ======================================= */}

              <div className="
                flex
                items-center
                justify-center
                w-8
                h-8
                rounded-md
                bg-slate-50
                border
                border-slate-200
                shrink-0
                group-hover:bg-white
                group-hover:border-sky-100
              ">

                <User
                  size={15}
                  className="
                    text-slate-400
                    group-hover:text-sky-500
                  "
                />

              </div>



              {/* ======================================= */}
              {/* INFORMACIÓN                             */}
              {/* ======================================= */}

              <div className="
                flex-1
                min-w-0
              ">

                <p className="
                  text-xs
                  font-medium
                  text-slate-700
                  truncate
                  group-hover:text-sky-700
                ">
                  {t.nombreTramitador}
                </p>


                {t.identificacion && (

                  <p className="
                    mt-0.5
                    text-[11px]
                    text-slate-400
                  ">
                    {t.identificacion}
                  </p>

                )}

              </div>



              {/* ======================================= */}
              {/* INDICADOR                               */}
              {/* ======================================= */}

              <Check
                size={15}
                className="
                  text-transparent
                  group-hover:text-sky-400
                "
              />

            </li>

          ))}

        </ul>

      )}



      {/* ================================================= */}
      {/* MENSAJE SIN RESULTADOS                            */}
      {/* ================================================= */}

      {open &&
        query.length >= 2 &&
        data.length === 0 && (

          <div className="
            absolute
            z-50
            mt-1
            w-full
            rounded-lg
            border
            border-slate-200
            bg-white
            shadow-lg
            px-4
            py-4
          ">

            <div className="
              flex
              items-center
              gap-2
              text-slate-400
            ">

              <Search size={15} />

              <span className="
                text-xs
              ">
                No se encontraron tramitadores.
              </span>

            </div>

          </div>

        )}

    </div>

  )
}