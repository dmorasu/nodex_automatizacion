import Link from "next/link";
import { Metadata } from "next";

import {
  ArrowLeft,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
} from "lucide-react";

import CargaMasivaClientes
  from "@/components/cargueMasivoClientes/cargaMasivaClientesForm";


export const metadata: Metadata = {
  title: "Nodex - Cargue Masivo de Clientes",
  description: "Nodex - Creación Masiva de Clientes",
};


export default function CargueMasivoClientesPage() {

  return (

    <div className="
      w-full
      space-y-6
    ">


      {/* ===================================================== */}
      {/* ENCABEZADO                                            */}
      {/* ===================================================== */}

      <div className="
        flex
        flex-col
        sm:flex-row
        sm:items-center
        sm:justify-between
        gap-4
      ">


        {/* ================================================= */}
        {/* TÍTULO                                             */}
        {/* ================================================= */}

        <div>

          <div className="
            flex
            items-center
            gap-2
          ">

            <div className="
              flex
              items-center
              justify-center
              w-9
              h-9
              rounded-lg
              bg-sky-50
              border
              border-sky-100
            ">

              <FileSpreadsheet
                size={18}
                className="
                  text-sky-500
                "
              />

            </div>


            <h1 className="
              text-xs
              font-semibold
              text-slate-800
            ">

              Creación Masiva de Clientes

            </h1>

          </div>


          <p className="
            mt-1
            ml-11
            text-xs
            text-slate-400
          ">

            Cree múltiples clientes mediante una plantilla de Excel.

          </p>

        </div>



        {/* ================================================= */}
        {/* VOLVER                                             */}
        {/* ================================================= */}

        <Link
          href="/center"
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            h-9
            px-3
            rounded-md
            border
            border-slate-200
            bg-white
            text-slate-500
            text-xs
            font-medium
            transition
            hover:bg-slate-50
            hover:text-slate-700
            hover:border-slate-300
          "
        >

          <ArrowLeft
            size={14}
          />

          Volver

        </Link>

      </div>



      {/* ===================================================== */}
      {/* PROCEDIMIENTO                                         */}
      {/* ===================================================== */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-xl
        p-5
      ">


        {/* ================================================= */}
        {/* ENCABEZADO                                         */}
        {/* ================================================= */}

        <div className="
          flex
          items-center
          gap-2
          mb-5
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

            <Upload
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

              Procedimiento para cargue masivo

            </h2>


            <p className="
              mt-0.5
              text-xs
              text-slate-400
            ">

              Siga los siguientes pasos para crear los clientes.

            </p>

          </div>

        </div>



        {/* ================================================= */}
        {/* PASOS                                             */}
        {/* ================================================= */}

        <div className="
          grid
          grid-cols-1
          md:grid-cols-2
          gap-3
        ">


          {/* ================================================= */}
          {/* PASO 1                                             */}
          {/* ================================================= */}

          <div className="
            flex
            items-start
            gap-3
            p-3
            rounded-lg
            bg-slate-50
            border
            border-slate-100
          ">

            <div className="
              flex
              items-center
              justify-center
              shrink-0
              w-7
              h-7
              rounded-full
              bg-sky-100
              text-sky-600
              text-xs
              font-semibold
            ">

              1

            </div>


            <div>

              <p className="
                text-xs
                font-medium
                text-slate-700
              ">

                Descargar la plantilla

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                Descargue la plantilla oficial de clientes.

              </p>

            </div>

          </div>



          {/* ================================================= */}
          {/* PASO 2                                             */}
          {/* ================================================= */}

          <div className="
            flex
            items-start
            gap-3
            p-3
            rounded-lg
            bg-slate-50
            border
            border-slate-100
          ">

            <div className="
              flex
              items-center
              justify-center
              shrink-0
              w-7
              h-7
              rounded-full
              bg-sky-100
              text-sky-600
              text-xs
              font-semibold
            ">

              2

            </div>


            <div>

              <p className="
                text-xs
                font-medium
                text-slate-700
              ">

                Registrar los datos

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                Registre la información de los clientes en la plantilla.

              </p>

            </div>

          </div>



          {/* ================================================= */}
          {/* PASO 3                                             */}
          {/* ================================================= */}

          <div className="
            flex
            items-start
            gap-3
            p-3
            rounded-lg
            bg-slate-50
            border
            border-slate-100
          ">

            <div className="
              flex
              items-center
              justify-center
              shrink-0
              w-7
              h-7
              rounded-full
              bg-sky-100
              text-sky-600
              text-xs
              font-semibold
            ">

              3

            </div>


            <div>

              <p className="
                text-xs
                font-medium
                text-slate-700
              ">

                Cargar el archivo

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                Seleccione y cargue el archivo con los clientes.

              </p>

            </div>

          </div>



          {/* ================================================= */}
          {/* PASO 4                                             */}
          {/* ================================================= */}

          <div className="
            flex
            items-start
            gap-3
            p-3
            rounded-lg
            bg-slate-50
            border
            border-slate-100
          ">

            <div className="
              flex
              items-center
              justify-center
              shrink-0
              w-7
              h-7
              rounded-full
              bg-sky-100
              text-sky-600
              text-xs
              font-semibold
            ">

              4

            </div>


            <div>

              <p className="
                text-xs
                font-medium
                text-slate-700
              ">

                Validar los datos

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                Verifique que la información cargada sea correcta.

              </p>

            </div>

          </div>



          {/* ================================================= */}
          {/* PASO 5                                             */}
          {/* ================================================= */}

          <div className="
            md:col-span-2
            flex
            items-start
            gap-3
            p-3
            rounded-lg
            bg-slate-50
            border
            border-slate-100
          ">

            <div className="
              flex
              items-center
              justify-center
              shrink-0
              w-7
              h-7
              rounded-full
              bg-emerald-50
              text-emerald-600
              border
              border-emerald-100
              text-xs
              font-semibold
            ">

              <CheckCircle2
                size={14}
              />

            </div>


            <div>

              <p className="
                text-xs
                font-medium
                text-slate-700
              ">

                Guardar los datos

              </p>


              <p className="
                mt-0.5
                text-xs
                text-slate-400
              ">

                Una vez validados, guarde los clientes en Nodex.

              </p>

            </div>

          </div>

        </div>

      </div>



      {/* ===================================================== */}
      {/* CARGUE                                               */}
      {/* ===================================================== */}

      <div className="
        bg-white
        border
        border-slate-200
        rounded-xl
        p-5
      ">


       


        <CargaMasivaClientes />

      </div>

    </div>

  );
}