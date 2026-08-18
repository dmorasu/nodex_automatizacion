"use client"

import { Fragment } from "react"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"

import {
  Menu,
  LayoutDashboard,
  Radar,
  ClipboardList,
  Users,
  Upload,
  UserRoundPlus,
  Settings2,
  LogOut,
  ChevronRight,
} from "lucide-react"

import Link from "next/link"

import { Usuario } from "@/src/schemas"

import { cerrarSesion } from "@/actions/cerrarSesion"


export default function CenterMenu({
  usuario,
}: {
  usuario: Usuario
}) {

  return (

    <Popover className="relative">

      {({ close }) => (

        <>

          {/* ================================================= */}
          {/* BOTÓN DEL MENÚ                                    */}
          {/* ================================================= */}

          <PopoverButton
            className="
              group
              flex
              items-center
              justify-center
              w-10
              h-10
              rounded-lg
              bg-white
              border
              border-slate-200
              text-slate-500
              shadow-sm
              transition-all
              duration-200
              hover:bg-slate-50
              hover:border-slate-300
              hover:text-slate-700
              focus:outline-none
              focus:ring-2
              focus:ring-sky-100
            "
          >

            <Menu
              size={21}
              strokeWidth={1.8}
              className="
                transition-transform
                duration-200
                group-hover:scale-105
              "
            />

          </PopoverButton>



          {/* ================================================= */}
          {/* MENÚ                                               */}
          {/* ================================================= */}

          <Transition
            as={Fragment}

            enter="
              transition
              ease-out
              duration-200
            "

            enterFrom="
              opacity-0
              translate-y-2
              scale-95
            "

            enterTo="
              opacity-100
              translate-y-0
              scale-100
            "

            leave="
              transition
              ease-in
              duration-150
            "

            leaveFrom="
              opacity-100
              translate-y-0
              scale-100
            "

            leaveTo="
              opacity-0
              translate-y-2
              scale-95
            "
          >

            <PopoverPanel
              className="
                absolute
                right-0
                z-50
                mt-3
                w-72
                origin-top-right
              "
            >

              <div className="
                overflow-hidden
                rounded-xl
                bg-white
                border
                border-slate-200
                shadow-xl
              ">


                {/* ========================================= */}
                {/* USUARIO                                    */}
                {/* ========================================= */}

                <div className="
                  px-4
                  py-4
                  bg-slate-50
                  border-b
                  border-slate-200
                ">

                  <div className="
                    flex
                    items-center
                    gap-3
                  ">


                    {/* AVATAR */}

                    <div className="
                      flex
                      items-center
                      justify-center
                      w-10
                      h-10
                      rounded-lg
                      bg-sky-50
                      border
                      border-sky-100
                      shrink-0
                    ">

                      <Users
                        size={19}
                        className="text-sky-500"
                      />

                    </div>


                    {/* NOMBRE */}

                    <div className="min-w-0">

                      <p className="
                        text-xs
                        text-slate-500
                        mb-0.5
                      ">
                        Hola
                      </p>

                      <p className="
                        text-sm
                        font-semibold
                        text-slate-800
                        truncate
                      ">

                        {usuario.nombreUsuario}

                      </p>

                    </div>

                  </div>

                </div>



                {/* ========================================= */}
                {/* NAVEGACIÓN                                 */}
                {/* ========================================= */}

                <div className="p-2">


                  {/* DASHBOARD */}

                  <Link
                    href="/center/dashboard"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-slate-50
                      hover:text-sky-600
                    "
                  >

                    <LayoutDashboard
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-sky-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Dashboard
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-sky-400
                      "
                    />

                  </Link>



                  {/* TORRE DE CONTROL */}

                  <Link
                    href="/center/torreControl"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-emerald-50
                      hover:text-emerald-600
                    "
                  >

                    <Radar
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-emerald-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Torre de Control
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-emerald-400
                      "
                    />

                  </Link>



                  {/* TRÁMITES */}

                  <Link
                    href="/center"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-sky-50
                      hover:text-sky-600
                    "
                  >

                    <ClipboardList
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-sky-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Trámites
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-sky-400
                      "
                    />

                  </Link>



                  {/* CLIENTES */}

                  <Link
                    href="/center/clientes/nuevo"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-indigo-50
                      hover:text-indigo-600
                    "
                  >

                    <Users
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-indigo-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Clientes
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-indigo-400
                      "
                    />

                  </Link>



                  {/* ======================================= */}
                  {/* SEPARADOR                                */}
                  {/* ======================================= */}

                  <div className="
                    my-2
                    border-t
                    border-slate-100
                  " />



                  {/* CARGUE MASIVO TRÁMITES */}

                  <Link
                    href="/center/cargueMasiva"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-teal-50
                      hover:text-teal-600
                    "
                  >

                    <Upload
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-teal-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Cargue Masivo Trámites
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-teal-400
                      "
                    />

                  </Link>



                  {/* CARGUE MASIVO CLIENTES */}

                  <Link
                    href="/center/cargueMasivoClientes"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-teal-50
                      hover:text-teal-600
                    "
                  >

                    <UserRoundPlus
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-teal-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Cargue Masivo Clientes
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-teal-400
                      "
                    />

                  </Link>



                  {/* GESTIÓN MASIVA */}

                  <Link
                    href="/center/gestionMasiva"
                    onClick={() => close()}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-600
                      transition
                      hover:bg-violet-50
                      hover:text-violet-600
                    "
                  >

                    <Settings2
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-violet-500
                      "
                    />

                    <span className="
                      flex-1
                      text-sm
                      font-medium
                    ">
                      Gestión Masiva Nodex
                    </span>

                    <ChevronRight
                      size={15}
                      className="
                        text-slate-300
                        group-hover:text-violet-400
                      "
                    />

                  </Link>

                </div>



                {/* ========================================= */}
                {/* CERRAR SESIÓN                             */}
                {/* ========================================= */}

                <div className="
                  border-t
                  border-slate-200
                  p-2
                ">

                  <button
                    type="button"
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      w-full
                      px-3
                      py-2.5
                      rounded-lg
                      text-slate-500
                      transition
                      hover:bg-red-50
                      hover:text-red-600
                    "
                    onClick={async () => {

                      close()

                      await cerrarSesion()

                    }}
                  >

                    <LogOut
                      size={18}
                      className="
                        text-slate-400
                        group-hover:text-red-500
                      "
                    />

                    <span className="
                      text-sm
                      font-medium
                    ">
                      Cerrar Sesión
                    </span>

                  </button>

                </div>


              </div>

            </PopoverPanel>

          </Transition>

        </>

      )}

    </Popover>

  )
}