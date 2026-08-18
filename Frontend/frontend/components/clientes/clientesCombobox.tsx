"use client"

import { useEffect, useState } from "react"

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  Dialog,
  DialogBackdrop,
  DialogPanel
} from "@headlessui/react"

import {
  UserRound,
  Search,
  X,
  UserPlus,
  CreditCard,
  CheckCircle2,
  Loader2
} from "lucide-react"

import { useClientesSearch } from "@/hooks/useClientesSearch"


interface Cliente {
  id: number
  nombreCliente: string
  identificacionCliente: string
}


interface Props {
  onChange?: (id: number | null) => void
  name?: string
  defaultValue?: number
}


export default function ClientesComboBox({
  onChange,
  name = "clienteId",
  defaultValue
}: Props) {

  const {
    search,
    setSearch,
    results,
    loading
  } = useClientesSearch()


  const [selected, setSelected] =
    useState<Cliente | null>(null)

  const [open, setOpen] =
    useState(false)


  // =====================================================
  // CARGAR CLIENTE SELECCIONADO
  // =====================================================

  useEffect(() => {

    if (!defaultValue) return


    const load = async () => {

      try {

        const r =
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/clientes/${defaultValue}`
          )


        if (!r.ok) return


        const data =
          await r.json()


        setSelected(data)

      } catch (error) {

        console.error(
          "Error cargando cliente:",
          error
        )

      }

    }


    load()

  }, [defaultValue])


  // =====================================================
  // SELECCIONAR CLIENTE
  // =====================================================

  const handleSelect = (
    cliente: Cliente | null
  ) => {

    setSelected(cliente)

    setOpen(false)

    setSearch("")

    onChange?.(
      cliente
        ? cliente.id
        : null
    )

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

          <UserRound
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

                {selected.nombreCliente}

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                {selected.identificacionCliente}

              </p>

            </>

          ) : (

            <p className="
              text-xs
              text-slate-400
            ">

              Seleccionar cliente...

            </p>

          )}

        </div>


        {/* INDICADOR */}

        <Search
          size={14}
          className="
            shrink-0
            text-slate-400
          "
        />

      </button>


      {/* ================================================= */}
      {/* HIDDEN INPUT                                      */}
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

                    <UserRound
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

                      Seleccionar cliente

                    </h2>


                    <p className="
                      mt-0.5
                      text-xs
                      text-slate-400
                    ">

                      Busque por nombre o identificación.

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
                onChange={handleSelect}
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
                      Buscar cliente por nombre o identificación...
                    "
                    displayValue={(
                      cliente: Cliente
                    ) =>
                      cliente
                        ? `${cliente.nombreCliente} (${cliente.identificacionCliente})`
                        : ""
                    }
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                  />

                </div>



                {/* ============================================= */}
                {/* CARGANDO                                     */}
                {/* ============================================= */}

                {loading && (

                  <div className="
                    flex
                    items-center
                    justify-center
                    gap-2
                    py-4
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

                      Buscando clientes...

                    </span>

                  </div>

                )}



                {/* ============================================= */}
                {/* LISTADO                                      */}
                {/* ============================================= */}

                <div className="
                  mt-3
                  border
                  border-slate-200
                  rounded-lg
                  overflow-hidden
                  max-h-64
                  overflow-y-auto
                ">


                  {search.length >= 2 &&
                  results.length === 0 &&
                  !loading ? (

                    /* ========================================= */
                    /* SIN RESULTADOS                            */
                    /* ========================================= */

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

                        <Search
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

                        No se encontraron clientes

                      </p>


                      <p className="
                        mt-1
                        text-xs
                        text-slate-400
                        text-center
                      ">

                        Puede crear un nuevo cliente.

                      </p>


                      <button
                        type="button"
                        onClick={() => {
                          window.location.href =
                            "/center/clientes/nuevo"
                        }}
                        className="
                          mt-3
                          inline-flex
                          items-center
                          gap-2
                          text-xs
                          font-medium
                          text-sky-600
                          hover:text-sky-700
                        "
                      >

                        <UserPlus
                          size={14}
                        />

                        Crear nuevo cliente

                      </button>

                    </div>

                  ) : (

                    /* ========================================= */
                    /* RESULTADOS                                */
                    /* ========================================= */

                    results.map(
                      (cliente) => (

                        <ComboboxOption
                          key={cliente.id}
                          value={cliente}
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


                              {/* ICONO CLIENTE */}

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

                                <UserRound
                                  size={15}
                                  className="
                                    text-slate-400
                                    group-data-[focus]:text-sky-500
                                  "
                                />

                              </div>


                              {/* DATOS */}

                              <div className="
                                min-w-0
                                flex-1
                              ">

                                <p className="
                                  text-xs
                                  font-semibold
                                  text-slate-700
                                  truncate
                                ">

                                  {
                                    cliente.nombreCliente
                                  }

                                </p>


                                <div className="
                                  flex
                                  items-center
                                  gap-1
                                  mt-1
                                ">

                                  <CreditCard
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
                                      cliente.identificacionCliente
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
                    )

                  )}

                </div>

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