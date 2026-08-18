"use client"

import { Fragment } from "react"
import Link from "next/link"

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition
} from "@headlessui/react"

import {
  MoreVertical,
  Eye,
  Pencil,
  Radar
} from "lucide-react"

import {
  SolicitudTramites
} from "@/src/schemas"


export default function SolicitudTramiteMenu({
  solicitudId
}: {
  solicitudId: SolicitudTramites["id"]
}) {


  return (

    <Menu
      as="div"
      className="
        relative
        inline-block
        text-left
      "
    >


      {/* ================================================= */}
      {/* BOTÓN                                             */}
      {/* ================================================= */}

      <MenuButton
        className="
          flex
          items-center
          justify-center

          w-8
          h-8

          rounded-md

          bg-white
          border
          border-slate-200

          text-slate-400

          transition

          hover:bg-sky-50
          hover:border-sky-200
          hover:text-sky-500

          focus:outline-none
          focus:ring-2
          focus:ring-sky-100
        "
      >

        <span className="sr-only">
          Opciones de solicitud
        </span>

        <MoreVertical
          size={16}
        />

      </MenuButton>



      {/* ================================================= */}
      {/* MENÚ                                              */}
      {/* ================================================= */}

      <Transition
        as={Fragment}

        enter="
          transition
          ease-out
          duration-100
        "

        enterFrom="
          opacity-0
          scale-95
          -translate-y-1
        "

        enterTo="
          opacity-100
          scale-100
          translate-y-0
        "

        leave="
          transition
          ease-in
          duration-75
        "

        leaveFrom="
          opacity-100
          scale-100
          translate-y-0
        "

        leaveTo="
          opacity-0
          scale-95
          -translate-y-1
        "
      >

        <MenuItems
          className="
            absolute
            right-0
            z-50
            mt-2

            w-48

            origin-top-right

            rounded-lg

            bg-white

            border
            border-slate-200

            shadow-lg

            p-1

            focus:outline-none
          "
        >


          {/* ============================================= */}
          {/* VER TRÁMITE                                   */}
          {/* ============================================= */}

          <MenuItem>

            {({ focus }) => (

              <Link
                href={
                  `/center/solicitudTramites/${solicitudId}`
                }

                className={`
                  flex
                  items-center
                  gap-2.5

                  w-full

                  px-3
                  py-2

                  rounded-md

                  text-xs
                  font-medium

                  transition

                  ${
                    focus
                      ? `
                        bg-sky-50
                        text-sky-600
                      `
                      : `
                        text-slate-600
                      `
                  }
                `}
              >

                <Eye
                  size={14}
                  className="
                    shrink-0
                    text-sky-500
                  "
                />

                <span>
                  Ver trámite
                </span>

              </Link>

            )}

          </MenuItem>



          {/* ============================================= */}
          {/* EDITAR                                        */}
          {/* ============================================= */}

          <MenuItem>

            {({ focus }) => (

              <Link
                href={
                  `/center/solicitudTramites/${solicitudId}/edit`
                }

                className={`
                  flex
                  items-center
                  gap-2.5

                  w-full

                  px-3
                  py-2

                  rounded-md

                  text-xs
                  font-medium

                  transition

                  ${
                    focus
                      ? `
                        bg-sky-50
                        text-sky-600
                      `
                      : `
                        text-slate-600
                      `
                  }
                `}
              >

                <Pencil
                  size={14}
                  className="
                    shrink-0
                    text-sky-500
                  "
                />

                <span>
                  Editar trámite
                </span>

              </Link>

            )}

          </MenuItem>



          {/* ============================================= */}
          {/* TORRE DE CONTROL                              */}
          {/* ============================================= */}

          <MenuItem>

            {({ focus }) => (

              <Link
                href="/center/torreControl"

                className={`
                  flex
                  items-center
                  gap-2.5

                  w-full

                  px-3
                  py-2

                  rounded-md

                  text-xs
                  font-medium

                  transition

                  ${
                    focus
                      ? `
                        bg-sky-50
                        text-sky-600
                      `
                      : `
                        text-slate-600
                      `
                  }
                `}
              >

                <Radar
                  size={14}
                  className="
                    shrink-0
                    text-sky-500
                  "
                />

                <span>
                  Torre de control
                </span>

              </Link>

            )}

          </MenuItem>


        </MenuItems>

      </Transition>

    </Menu>

  )
}