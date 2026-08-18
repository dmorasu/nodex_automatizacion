"use client";

import { useState } from "react";
import { SolicitudTramites } from "@/src/schemas";

import ClientesComboBox
  from "../clientes/clientesCombobox";

import MunicipiosComboBox
  from "../municipios/municipiosCombobox";

import OperacionesSelect
  from "../operaciones/operacionesSelect";

import EntidadesSelect
  from "../entidad/entidadSelect";

import TramitesSelect
  from "../tramites/tramitesSelect";

import { toDateInput } from "@/src/ultis";

import { Paperclip, X } from "lucide-react";
import DocumentosSolicitud from "../documentos/DocumentosSolicitud";


export default function SolicitudTramitesForm({
  solicitud
}: {
  solicitud?: SolicitudTramites
}) {

  const [tipoDocumento, setTipoDocumento] =
    useState("");

const [mostrarDocumentos, setMostrarDocumentos] =
  useState(false);
  return (

    <div className="
      w-full
      space-y-4
    ">


      {/* ================================================= */}
      {/* CLIENTE                                           */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
        overflow-visible
      ">

        <label
          htmlFor="clienteId"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Cliente

        </label>


        <ClientesComboBox
          name="clienteId"
          defaultValue={
            solicitud?.clientes?.id
          }
        />

      </div>



      {/* ================================================= */}
      {/* DETALLE SOLICITUD                                 */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="detalleSolicitud"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Detalle de la solicitud

        </label>


        <textarea
          id="detalleSolicitud"
          name="detalleSolicitud"
          rows={4}
          placeholder="Describa el detalle de la solicitud"
          defaultValue={
            solicitud?.detalleSolicitud
          }
          className="
            w-full
            px-3
            py-2.5
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            resize-y
            transition
            placeholder:text-slate-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>



      {/* ================================================= */}
      {/* DIRECCIÓN                                         */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="direccionTramite"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Dirección del trámite

        </label>


        <input
          type="text"
          id="direccionTramite"
          name="direccionTramite"
          placeholder="Dirección donde se realizará el trámite"
          defaultValue={
            solicitud?.direccionTramite
          }
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            placeholder:text-slate-300
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>



      {/* ================================================= */}
      {/* MUNICIPIO                                         */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
        overflow-visible
      ">

        <label
          htmlFor="municipioId"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Municipio

        </label>


        <MunicipiosComboBox
          name="municipioId"
          defaultValue={
            solicitud?.municipios?.id
          }
        />

      </div>



      {/* ================================================= */}
      {/* FECHA DE ENTREGA                                  */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
      ">

        <label
          htmlFor="fechaEntregaResultado"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Fecha de entrega del resultado

        </label>


        <input
          type="date"
          id="fechaEntregaResultado"
          name="fechaEntregaResultado"
          defaultValue={
            toDateInput(
              solicitud?.fechaEntregaResultado ?? ""
            )
          }
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        />

      </div>



      {/* ================================================= */}
      {/* OPERACIÓN                                         */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
        overflow-visible
      ">

        <label
          htmlFor="operacionId"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Operación

        </label>


        <OperacionesSelect
          name="operacionId"
          defaultValue={
            solicitud?.operaciones?.id
          }
        />

      </div>



      {/* ================================================= */}
      {/* ENTIDAD                                           */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
        overflow-visible
      ">

        <label
          htmlFor="entidadId"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Entidad

        </label>


        <EntidadesSelect
          name="entidadId"
          defaultValue={
            solicitud?.entidad?.id
          }
        />

      </div>



      {/* ================================================= */}
      {/* TRÁMITE                                           */}
      {/* ================================================= */}

      <div className="
        space-y-1.5
        overflow-visible
      ">

        <label
          htmlFor="tramiteId"
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Trámite

        </label>


        <TramitesSelect
          name="tramiteId"
          defaultValue={
            solicitud?.tramite?.id
          }
        />

      </div>



      {/* ================================================= */}
      {/* IDENTIFICACIÓN DEL INMUEBLE                      */}
      {/* ================================================= */}

      <div className="
        space-y-3
        pt-1
      ">

        <label
          className="
            block
            text-xs
            font-medium
            text-slate-600
          "
        >

          Identificación del inmueble

        </label>


        {/* =============================================== */}
        {/* TIPO DE IDENTIFICACIÓN                          */}
        {/* =============================================== */}

        <select
          name="tipoDocumento"
          value={tipoDocumento}
          onChange={(e) =>
            setTipoDocumento(
              e.target.value
            )
          }
          required
          className="
            w-full
            h-10
            px-3
            text-xs
            text-slate-700
            bg-white
            border
            border-slate-200
            rounded-md
            outline-none
            transition
            focus:border-sky-400
            focus:ring-2
            focus:ring-sky-100
          "
        >

          <option value="">
            Seleccione una opción
          </option>

          <option value="placa">
            Placa
          </option>

          <option value="matricula">
            Matrícula inmobiliaria
          </option>

        </select>



        {/* =============================================== */}
        {/* PLACA                                           */}
        {/* =============================================== */}

        {tipoDocumento === "placa" && (

          <div className="
            space-y-1.5
          ">

            <label
              htmlFor="placa"
              className="
                block
                text-xs
                font-medium
                text-slate-600
              "
            >

              Placa

            </label>


            <input
              type="text"
              id="placa"
              name="placa"
              required
              placeholder="Ingrese la placa"
              defaultValue={
                solicitud?.placa ?? ""
              }
              className="
                w-full
                h-10
                px-3
                text-xs
                text-slate-700
                bg-white
                border
                border-slate-200
                rounded-md
                outline-none
                transition
                placeholder:text-slate-300
                focus:border-sky-400
                focus:ring-2
                focus:ring-sky-100
              "
            />

          </div>

        )}



        {/* =============================================== */}
        {/* MATRÍCULA                                       */}
        {/* =============================================== */}

        {tipoDocumento === "matricula" && (

          <div className="
            space-y-1.5
          ">

            <label
              htmlFor="matricula"
              className="
                block
                text-xs
                font-medium
                text-slate-600
              "
            >

              Matrícula inmobiliaria

            </label>


            <input
              type="text"
              id="matricula"
              name="matricula"
              required
              placeholder="Ingrese la matrícula inmobiliaria"
              defaultValue={
                solicitud?.matriculaInmobiliaria ?? ""
              }
              className="
                w-full
                h-10
                px-3
                text-xs
                text-slate-700
                bg-white
                border
                border-slate-200
                rounded-md
                outline-none
                transition
                placeholder:text-slate-300
                focus:border-sky-400
                focus:ring-2
                focus:ring-sky-100
              "
            />

          </div>

        )}

      </div>

{/* ================================================= */}
{/* DOCUMENTOS                                      */}
{/* ================================================= */}

<div className="space-y-1.5">

  <label
    className="
      block
      text-xs
      font-medium
      text-slate-600
    "
  >
    Documentos
  </label>


  {solicitud?.id ? (

    <button
      type="button"
      onClick={() =>
        setMostrarDocumentos(true)
      }
      className="
        w-full
        h-10
        px-3
        flex
        items-center
        justify-between
        text-xs
        text-slate-600
        bg-white
        border
        border-slate-200
        rounded-md
        hover:border-sky-400
        hover:bg-sky-50
        transition
      "
    >

      <span className="
        flex
        items-center
        gap-2
      ">

        <Paperclip
          size={17}
          className="text-sky-500"
        />

        Cargar documentos

      </span>


      <span className="
        text-sky-600
        font-medium
      ">

        Gestionar

      </span>

    </button>

  ) : (

    <div className="
      w-full
      min-h-10
      px-3
      py-2
      flex
      items-center
      gap-2
      text-xs
      text-slate-400
      bg-slate-50
      border
      border-slate-200
      rounded-md
    ">

      <Paperclip size={17} />

      Guarde primero la solicitud para cargar documentos

    </div>

  )}

</div>

    </div>

  );
}