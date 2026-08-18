import Logo from "@/components/ui/Logo"
import ToastNotificaciones from "@/components/ui/notificaciones"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <div className="
        min-h-screen
        lg:grid
        lg:grid-cols-2
        bg-slate-50
      ">

        {/* ================================================= */}
        {/* PANEL IZQUIERDO                                  */}
        {/* ================================================= */}

        <div className="
          relative
          hidden
          lg:flex
          min-h-screen
          overflow-hidden

          bg-gradient-to-br
          from-sky-600
          via-blue-700
          to-indigo-900

          motion-safe:animate-[fadeIn_700ms_ease-out]
        ">

          {/* =============================================== */}
          {/* LUCES                                           */}
          {/* =============================================== */}

          <div className="
            absolute
            -top-32
            -left-32

            w-96
            h-96

            rounded-full

            bg-white/10
            blur-3xl

            motion-safe:animate-pulse
          " />

          <div className="
            absolute
            top-1/3
            -right-40

            w-80
            h-80

            rounded-full

            bg-indigo-400/20
            blur-3xl

            motion-safe:animate-pulse
          " />

          <div className="
            absolute
            -bottom-40
            left-1/3

            w-[450px]
            h-[450px]

            rounded-full

            bg-sky-300/10
            blur-3xl

            motion-safe:animate-pulse
          " />


          {/* =============================================== */}
          {/* CÍRCULOS                                       */}
          {/* =============================================== */}

          <div className="
            absolute

            top-1/2
            left-1/2

            -translate-x-1/2
            -translate-y-1/2

            w-72
            h-72

            rounded-full

            border
            border-white/10

            motion-safe:animate-[scaleIn_1.2s_ease-out]
          " />

          <div className="
            absolute

            top-1/2
            left-1/2

            -translate-x-1/2
            -translate-y-1/2

            w-96
            h-96

            rounded-full

            border
            border-white/5

            motion-safe:animate-[scaleIn_1.5s_ease-out]
          " />


          {/* =============================================== */}
          {/* CONTENIDO                                      */}
          {/* =============================================== */}

          <div className="
            relative
            z-10

            w-full

            flex
            flex-col
            items-center
            justify-center

            px-12
          ">

            {/* LOGO */}

            <div className="
              flex
              items-center
              justify-center

              mb-10

              p-8

              rounded-2xl

              bg-white/10
              backdrop-blur-md

              border
              border-white/10

              shadow-2xl

              motion-safe:animate-[fadeUp_800ms_cubic-bezier(0.22,1,0.36,1)]
            ">

              <Logo />

            </div>


            {/* TEXTO */}

            <div className="
              max-w-sm
              text-center

              motion-safe:animate-[fadeUp_800ms_cubic-bezier(0.22,1,0.36,1)]
              motion-safe:[animation-delay:200ms]
              motion-safe:[animation-fill-mode:both]
            ">

              <h2 className="
                text-xl
                font-semibold
                text-white
              ">

                Módulo de Gestión de Trámites

              </h2>


              <p className="
                mt-3

                text-xs
                leading-5

                text-blue-100/80
              ">

                Centraliza, organiza y controla
                el seguimiento de tus trámites
                desde un solo lugar.

              </p>

            </div>

          </div>

        </div>


        {/* ================================================= */}
        {/* PANEL DERECHO                                    */}
        {/* ================================================= */}

        <div className="
          min-h-screen

          flex
          items-center
          justify-center

          px-5
          py-10

          sm:px-8
          lg:px-12
        ">

          <div className="
            w-full
            max-w-md
          ">


            {/* ============================================= */}
            {/* LOGO MOBILE                                  */}
            {/* ============================================= */}

            <div className="
              flex
              justify-center

              mb-10

              lg:hidden

              motion-safe:animate-[fadeUp_700ms_ease-out]
            ">

              <div className="
                p-5

                rounded-xl

                bg-white

                border
                border-slate-200

                shadow-sm

                transition-all
                duration-300

                hover:shadow-md
                hover:scale-[1.02]
              ">

                <Logo />

              </div>

            </div>


            {/* ============================================= */}
            {/* LOGIN                                        */}
            {/* ============================================= */}

            <div className="
              motion-safe:animate-[fadeUp_900ms_cubic-bezier(0.22,1,0.36,1)]
              motion-safe:[animation-delay:250ms]
              motion-safe:[animation-fill-mode:both]
            ">

              {children}

            </div>


            {/* ============================================= */}
            {/* FOOTER                                       */}
            {/* ============================================= */}

            <p className="
              mt-10

              text-center

              text-[10px]

              text-slate-400

              motion-safe:animate-[fadeIn_1s_ease-out]
              motion-safe:[animation-delay:700ms]
              motion-safe:[animation-fill-mode:both]
            ">

              Nodex · Control y Gestión

            </p>

          </div>

        </div>

      </div>


      <ToastNotificaciones />

    </>
  )
}