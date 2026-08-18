"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Combobox,
  ComboboxInput,
  ComboboxOption
} from "@headlessui/react"

import {
  MapPin,
  Search,
  X,
  Map,
  CheckCircle2,
  Loader2
} from "lucide-react"

import {
  useMunicipiosSearch
} from "@/hooks/useMunicipiosSearch"


interface Municipio {
  id: number
  nombreMunicipio: string
  departamento: string
}


interface Props {
  onChange?: (value: number | null) => void
  defaultValue?: number
  name?: string
}


export default function MunicipiosModalSelect({
  onChange,
  defaultValue,
  name = "municipioId"
}: Props) {


  const {
    search,
    setSearch,
    results,
    loading
  } = useMunicipiosSearch()


  const [selected, setSelected] =
    useState<Municipio | null>(null)

  const [open, setOpen] =
    useState(false)



  // =====================================================
  // CARGAR MUNICIPIO POR DEFECTO
  // =====================================================

  useEffect(() => {

    const loadDefault = async () => {

      if (!defaultValue) return

      try {

        const res =
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/municipios/${defaultValue}`
          )

        if (!res.ok) return

        const data =
          await res.json()

        setSelected(data)

      } catch (error) {

        console.error(
          "Error cargando municipio:",
          error
        )

      }

    }

    loadDefault()

  }, [defaultValue])



  // =====================================================
  // SELECCIONAR MUNICIPIO
  // =====================================================

  const selectMunicipio = (
    municipio: Municipio | null
  ) => {

    setSelected(municipio)

    onChange?.(
      municipio
        ? municipio.id
        : null
    )

    setSearch("")

    setOpen(false)

  }



  // =====================================================
  // CERRAR MODAL
  // =====================================================

  const closeModal = () => {

    setOpen(false)

    setSearch("")

  }



  return (

    <div className="
      w-full
    ">


      {/* ================================================= */}
      {/* SELECTOR PRINCIPAL                                */}
      {/* ================================================= */}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          w-full
          min-h-10
          px-3
          flex
          items-center
          gap-3
          text-left
          bg-white
          border
          border-slate-200
          rounded-md
          transition
          hover:border-sky-300
          focus:outline-none
          focus:border-sky-400
          focus:ring-2
          focus:ring-sky-100
        "
      >


        {/* ICONO */}

        <div className="
          flex
          items-center
          justify-center
          shrink-0
          w-7
          h-7
          rounded-md
          bg-sky-50
          border
          border-sky-100
        ">

          <MapPin
            size={14}
            className="
              text-sky-500
            "
          />

        </div>



        {/* INFORMACIÓN */}

        <div className="
          min-w-0
          flex-1
        ">

          {selected ? (

            <>

              <p className="
                text-xs
                font-medium
                text-slate-700
                truncate
              ">

                {selected.nombreMunicipio}

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                {selected.departamento}

              </p>

            </>

          ) : (

            <p className="
              text-xs
              text-slate-400
            ">

              Seleccionar municipio...

            </p>

          )}

        </div>



        {/* LUPA */}

        <Search
          size={14}
          className="
            shrink-0
            text-slate-400
          "
        />

      </button>



      {/* ================================================= */}
      {/* INPUT OCULTO                                      */}
      {/* ================================================= */}

      <input
        type="hidden"
        name={name}
        value={
          selected?.id ?? ""
        }
      />



      {/* ================================================= */}
      {/* MODAL                                             */}
      {/* ================================================= */}

      <Dialog
        open={open}
        onClose={closeModal}
        className="
          relative
          z-50
        "
      >


        {/* ================================================= */}
        {/* BACKDROP                                         */}
        {/* ================================================= */}

        <DialogBackdrop
          className="
            fixed
            inset-0
            bg-slate-900/30
            backdrop-blur-[2px]
          "
        />


        <div className="
          fixed
          inset-0
          flex
          items-center
          justify-center
          p-4
        ">


          <DialogPanel
            className="
              w-full
              max-w-lg
              bg-white
              rounded-xl
              border
              border-slate-200
              shadow-xl
              overflow-hidden
            "
          >


            {/* ================================================= */}
            {/* HEADER                                           */}
            {/* ================================================= */}

            <div className="
              px-5
              py-4
              border-b
              border-slate-100
              bg-white
            ">


              <div className="
                flex
                items-center
                justify-between
              ">


                {/* TÍTULO */}

                <div className="
                  flex
                  items-center
                  gap-3
                ">


                  <div className="
                    flex
                    items-center
                    justify-center
                    w-8
                    h-8
                    rounded-lg
                    bg-sky-50
                    border
                    border-sky-100
                  ">

                    <MapPin
                      size={15}
                      className="
                        text-sky-500
                      "
                    />

                  </div>


                  <div>

                    <h2 className="
                      text-xs
                      font-semibold
                      text-slate-700
                    ">

                      Seleccionar municipio

                    </h2>


                    <p className="
                      mt-0.5
                      text-xs
                      text-slate-400
                    ">

                      Busque por municipio o departamento.

                    </p>

                  </div>

                </div>



                {/* CERRAR */}

                <button
                  type="button"
                  onClick={closeModal}
                  className="
                    flex
                    items-center
                    justify-center
                    w-7
                    h-7
                    rounded-md
                    text-slate-400
                    transition
                    hover:bg-slate-100
                    hover:text-slate-600
                  "
                >

                  <X
                    size={15}
                  />

                </button>

              </div>

            </div>



            {/* ================================================= */}
            {/* CONTENIDO                                       */}
            {/* ================================================= */}

            <div className="
              p-5
            ">


              <Combobox
                value={selected}
                onChange={selectMunicipio}
              >


                {/* ============================================= */}
                {/* BUSCADOR                                      */}
                {/* ============================================= */}

                <div className="
                  relative
                ">


                  <Search
                    size={14}
                    className="
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-slate-400
                      pointer-events-none
                    "
                  />


                  <ComboboxInput
                    autoFocus
                    className="
                      w-full
                      h-10
                      pl-9
                      pr-3
                      text-xs
                      text-slate-700
                      bg-slate-50
                      border
                      border-slate-200
                      rounded-md
                      outline-none
                      transition
                      placeholder:text-slate-400
                      focus:bg-white
                      focus:border-sky-400
                      focus:ring-2
                      focus:ring-sky-100
                    "
                    placeholder="
                      Buscar municipio o departamento...
                    "
                    displayValue={(
                      municipio: Municipio
                    ) =>
                      municipio?.nombreMunicipio ?? ""
                    }
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                  />

                </div>



                {/* ============================================= */}
                {/* LISTADO                                      */}
                {/* ============================================= */}

                {search.length >= 2 && (

                  <div className="
                    mt-3
                    border
                    border-slate-200
                    rounded-lg
                    overflow-hidden
                    max-h-64
                    overflow-y-auto
                  ">


                    {/* ========================================= */}
                    {/* CARGANDO                                 */}
                    {/* ========================================= */}

                    {loading && (

                      <div className="
                        flex
                        items-center
                        justify-center
                        gap-2
                        py-5
                      ">

                        <Loader2
                          size={14}
                          className="
                            animate-spin
                            text-sky-500
                          "
                        />

                        <span className="
                          text-xs
                          text-slate-400
                        ">

                          Buscando municipios...

                        </span>

                      </div>

                    )}



                    {/* ========================================= */}
                    {/* SIN RESULTADOS                            */}
                    {/* ========================================= */}

                    {!loading &&
                    results.length === 0 && (

                      <div className="
                        flex
                        flex-col
                        items-center
                        justify-center
                        py-8
                        px-4
                      ">


                        <div className="
                          flex
                          items-center
                          justify-center
                          w-9
                          h-9
                          rounded-lg
                          bg-slate-50
                          border
                          border-slate-200
                        ">

                          <Map
                            size={16}
                            className="
                              text-slate-400
                            "
                          />

                        </div>


                        <p className="
                          mt-3
                          text-xs
                          font-medium
                          text-slate-600
                        ">

                          No se encontraron municipios

                        </p>


                        <p className="
                          mt-1
                          text-xs
                          text-slate-400
                          text-center
                        ">

                          Verifique el nombre o departamento.

                        </p>

                      </div>

                    )}



                    {/* ========================================= */}
                    {/* RESULTADOS                                */}
                    {/* ========================================= */}

                    {!loading &&
                    results.map(
                      (municipio) => (

                        <ComboboxOption
                          key={municipio.id}
                          value={municipio}
                          className="
                            group
                            cursor-pointer
                            px-3
                            py-3
                            border-b
                            border-slate-100
                            last:border-b-0
                            transition
                            data-[focus]:bg-sky-50
                          "
                        >

                          {({
                            selected
                          }) => (

                            <div className="
                              flex
                              items-center
                              gap-3
                            ">


                              {/* ICONO */}

                              <div className="
                                flex
                                items-center
                                justify-center
                                shrink-0
                                w-8
                                h-8
                                rounded-lg
                                bg-slate-50
                                border
                                border-slate-200
                                group-data-[focus]:bg-white
                                group-data-[focus]:border-sky-100
                              ">

                                <MapPin
                                  size={15}
                                  className="
                                    text-slate-400
                                    group-data-[focus]:text-sky-500
                                  "
                                />

                              </div>



                              {/* INFORMACIÓN */}

                              <div className="
                                min-w-0
                                flex-1
                              ">


                                <p className="
                                  text-xs
                                  font-semibold
                                  text-slate-700
                                ">

                                  {
                                    municipio.nombreMunicipio
                                  }

                                </p>


                                <div className="
                                  flex
                                  items-center
                                  gap-1
                                  mt-1
                                ">

                                  <Map
                                    size={11}
                                    className="
                                      text-slate-400
                                    "
                                  />


                                  <span className="
                                    text-xs
                                    text-slate-400
                                  ">

                                    {
                                      municipio.departamento
                                    }

                                  </span>

                                </div>

                              </div>



                              {/* SELECCIONADO */}

                              {selected && (

                                <CheckCircle2
                                  size={16}
                                  className="
                                    shrink-0
                                    text-sky-500
                                  "
                                />

                              )}

                            </div>

                          )}

                        </ComboboxOption>

                      )
                    )}

                  </div>

                )}

              </Combobox>

            </div>



            {/* ================================================= */}
            {/* FOOTER                                           */}
            {/* ================================================= */}

            <div className="
              px-5
              py-3
              border-t
              border-slate-100
              bg-slate-50
              flex
              justify-end
            ">

              <button
                type="button"
                onClick={closeModal}
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  h-8
                  px-3
                  rounded-md
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  text-xs
                  font-medium
                  transition
                  hover:bg-slate-100
                  hover:text-slate-700
                "
              >

                <X
                  size={13}
                />

                Cerrar

              </button>

            </div>


          </DialogPanel>

        </div>

      </Dialog>

    </div>

  )
}