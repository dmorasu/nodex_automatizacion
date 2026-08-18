"use client"

import { autenticacion } from "@/actions/iniciarSesion"
import { useEffect } from "react"
import { useFormState } from "react-dom"
import { toast } from "react-toastify"

import {
  Mail,
  LockKeyhole,
  LogIn
} from "lucide-react"


export default function LoginForm() {

  const [state, dispatch] =
    useFormState(
      autenticacion,
      {
        errors: []
      }
    )


  useEffect(() => {

    if (state.errors) {

      state.errors.forEach(error => {

        toast.error(error)

      })

    }

  }, [state])


  return (

    <form
      action={dispatch}
      className="
        space-y-5
      "
      noValidate
    >


      {/* ============================================== */}
      {/* USUARIO                                        */}
      {/* ============================================== */}

      <div className="space-y-2">

        <label
          htmlFor="correoUsuario"
          className="
            flex
            items-center
            gap-2

            text-xs
            font-semibold
            text-slate-600
          "
        >

          <Mail
            size={14}
            className="text-sky-500"
          />

          Correo electrónico

        </label>


        <input
          id="correoUsuario"
          type="email"
          placeholder="correo@empresa.com"
          className="
            w-full
            h-10

            px-3

            border
            border-slate-200

            rounded-md

            bg-white

            text-xs
            text-slate-700

            placeholder:text-slate-300

            outline-none

            transition

            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
          name="correoUsuario"
          autoComplete="email"
        />

      </div>



      {/* ============================================== */}
      {/* CONTRASEÑA                                    */}
      {/* ============================================== */}

      <div className="space-y-2">

        <label
          htmlFor="contrasena"
          className="
            flex
            items-center
            gap-2

            text-xs
            font-semibold
            text-slate-600
          "
        >

          <LockKeyhole
            size={14}
            className="text-sky-500"
          />

          Contraseña

        </label>


        <input
          id="contrasena"
          type="password"
          placeholder="Ingresa tu contraseña"
          className="
            w-full
            h-10

            px-3

            border
            border-slate-200

            rounded-md

            bg-white

            text-xs
            text-slate-700

            placeholder:text-slate-300

            outline-none

            transition

            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
          name="contrasena"
          autoComplete="current-password"
        />

      </div>



      {/* ============================================== */}
      {/* BOTÓN                                          */}
      {/* ============================================== */}

      <button
        type="submit"
        className="
          w-full
          h-10

          flex
          items-center
          justify-center
          gap-2

          rounded-md

          bg-sky-500
          text-white

          text-xs
          font-semibold

          transition

          hover:bg-sky-600

          focus:outline-none
          focus:ring-2
          focus:ring-sky-200

          shadow-sm
        "
      >

        <LogIn
          size={15}
        />

        Iniciar sesión

      </button>


    </form>

  )
}