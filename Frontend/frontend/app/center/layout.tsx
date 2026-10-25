import CenterMenu from "@/components/menuCenter/centerMenu";
import AccesosRapidos from "@/components/menuCenter/AccesosRapidos";
import LogoEncabezado from "@/components/ui/LogoEncabezado";
import ToastNotificaciones from "@/components/ui/notificaciones";
import { verificacionSesion } from "@/src/auth/dal";
import { ProveedorPerfil } from "@/src/auth/PerfilContexto";
import Link from "next/link";

export default async function CenterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const { usuario, perfil, esAdmin, esAnalista, puedeAsignarAnalistas, puedeConfigurarNotificaciones } = await verificacionSesion();

  return (
    // Un solo contenedor para encabezado, contenido y pie: Headless UI toma cada hijo directo de
    // <body> distinto al del menú como "otra ventana" y un clic ahí no cerraba el menú de arriba
    <div>

      {/* ===================================================== */}
      {/* HEADER                                                */}
      {/* ===================================================== */}

      {/* Fijo arriba: el menú y los accesos quedan a la mano aunque se baje en la página */}
      <header className="
        sticky
        top-0
        z-40
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
          {/* ACCESOS RÁPIDOS                                  */}
          {/* =============================================== */}

          <div className="
            hidden
            md:flex
            flex-1
            items-center
            justify-center
            px-6
          ">

            <AccesosRapidos perfil={perfil} />

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
              perfil={perfil}
              esAdmin={esAdmin}
              puedeAsignarAnalistas={puedeAsignarAnalistas}
              puedeConfigurarNotificaciones={puedeConfigurarNotificaciones}
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

        <ProveedorPerfil perfil={perfil} permisos={{ esAnalista, puedeAsignarAnalistas, usuarioId: usuario.id }}>

        {children}

      </ProveedorPerfil>

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

    </div>
  );
}