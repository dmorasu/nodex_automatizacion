import CenterMenu from "@/components/menuCenter/centerMenu";
import LogoEncabezado from "@/components/ui/LogoEncabezado";
import ToastNotificaciones from "@/components/ui/notificaciones";
import { verificacionSesion } from "@/src/auth/dal";
import Link from "next/link";

export default async function CenterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const { usuario } = await verificacionSesion();

  return (
    <>

      {/* ===================================================== */}
      {/* HEADER                                                */}
      {/* ===================================================== */}

      <header className="
        bg-white
        border-b
        border-slate-200
        shadow-sm
      ">

        <div className="
          max-w-7xl
          mx-auto
          h-16
          px-4
          sm:px-6
          lg:px-8
          flex
          items-center
          justify-between
        ">


          {/* =============================================== */}
          {/* LOGO                                             */}
          {/* =============================================== */}

          <Link
            href="/center/dashboard"
            className="
              flex
              items-center
              shrink-0
              transition-opacity
              hover:opacity-80
            "
          >

            <LogoEncabezado />

          </Link>



          {/* =============================================== */}
          {/* INFORMACIÓN DEL MÓDULO                           */}
          {/* =============================================== */}

          <div className="
            hidden
            md:flex
            flex-1
            items-center
            justify-center
            px-8
          ">

            <div className="
              flex
              items-center
              gap-3
            ">


              {/* =========================================== */}
              {/* SEPARADOR                                   */}
              {/* =========================================== */}

              <div className="
                h-8
                w-px
                bg-slate-200
              " />


              {/* =========================================== */}
              {/* INFORMACIÓN                                 */}
              {/* =========================================== */}

              <div>

                <p className="
                  text-sm
                  font-semibold
                  text-slate-700
                  leading-tight
                ">

                  Módulo de Gestión de Trámites

                </p>


                <p className="
                  text-xs
                  text-slate-400
                  mt-0.5
                ">

                  Administración y seguimiento de solicitudes

                </p>

              </div>


            </div>

          </div>



          {/* =============================================== */}
          {/* MENÚ                                             */}
          {/* =============================================== */}

          <div className="
            flex
            items-center
            shrink-0
          ">

            <CenterMenu
              usuario={usuario}
            />

          </div>


        </div>

      </header>



      {/* ===================================================== */}
      {/* CONTENIDO                                             */}
      {/* ===================================================== */}

      <main className="
        max-w-7xl
        mx-auto
        px-4
        sm:px-6
        lg:px-8
        pt-8
        pb-10
      ">

        {children}

      </main>



      {/* ===================================================== */}
      {/* NOTIFICACIONES                                       */}
      {/* ===================================================== */}

      <ToastNotificaciones />



      {/* ===================================================== */}
      {/* FOOTER                                                */}
      {/* ===================================================== */}

      <footer className="
        border-t
        border-slate-200
        bg-white
        py-5
        mt-8
      ">

        <p className="
          text-center
          text-xs
          text-slate-400
        ">

          Todos los Derechos Reservados{" "}

          {new Date().getFullYear()}

        </p>

      </footer>

    </>
  );
}