import LoginForm from "@/components/auth/LoginForm"
import React from "react"
import { ShieldCheck } from "lucide-react"

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md">

      {/* ================================================= */}
      {/* ENCABEZADO                                       */}
      {/* ================================================= */}

      <div className="mb-9">

        {/* Indicador superior */}

        <div className="
          inline-flex
          items-center
          gap-2

          px-3
          py-1.5

          rounded-full

          bg-sky-50
          border
          border-sky-100

          text-[10px]
          font-semibold
          uppercase
          tracking-wider

          text-sky-600

          mb-5
        ">

          <ShieldCheck size={13} />

          Acceso seguro

        </div>


        {/* TÍTULO */}

        <h1 className="
          text-3xl
          sm:text-4xl

          font-semibold

          tracking-tight

          bg-gradient-to-r
          from-slate-800
          via-slate-700
          to-sky-500

          bg-clip-text
          text-transparent
        ">

          Bienvenido a Nodex

        </h1>


        {/* DESCRIPCIÓN */}

        <p className="
          mt-3

          text-sm
          leading-6

          text-slate-400
        ">

          Inicia sesión para acceder al{" "}

          <span className="
            font-medium
            text-slate-600
          ">
            módulo de gestión de trámites
          </span>

          {" "}y administrar tus procesos.

        </p>


        {/* LÍNEA DECORATIVA */}

        <div className="
          mt-6

          h-px
          w-full

          bg-gradient-to-r
          from-sky-400
          via-slate-200
          to-transparent
        " />

      </div>


      {/* ================================================= */}
      {/* LOGIN                                             */}
      {/* ================================================= */}

      <LoginForm />


      {/* ================================================= */}
      {/* INFORMACIÓN                                      */}
      {/* ================================================= */}

      <div className="
        mt-8

        flex
        items-center
        justify-center
        gap-2
      ">

        <div className="
          w-1.5
          h-1.5

          rounded-full

          bg-emerald-400
        " />

        <p className="
          text-[10px]
          text-slate-400
        ">

          Plataforma de gestión y control

        </p>

      </div>

    </div>
  )
}