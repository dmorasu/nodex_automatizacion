"use client";

import { useState } from "react";
import clsx from "clsx";
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

import { Paperclip } from "lucide-react";
import CampoDireccion, { type MunicipioSugerido } from "../direcciones/CampoDireccion";
import SelectBuscable from "@/components/ui/SelectBuscable"



// Largo máximo del detalle (lo valida también el backend)
const MAXIMO_DETALLE = 200;

export default function SolicitudTramitesForm({
  solicitud
}: {
  solicitud?: SolicitudTramites
}) {

  const [tipoDocumento, setTipoDocumento] =
    useState("");

  // Municipio que propone la dirección elegida en Google
  // Contador del detalle (máximo 200 caracteres, igual que el backend)
  const [largoDetalle, setLargoDetalle] =
    useState(solicitud?.detalleSolicitud?.length ?? 0);

  const [municipioSugerido, setMunicipioSugerido] =
    useState<MunicipioSugerido | null>(null);

// TODO: el valor no se usa (el panel de documentos no se muestra en el formulario)
const [, setMostrarDocumentos] =
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
          maxLength={MAXIMO_DETALLE}
          placeholder="Describa el detalle de la solicitud (máximo 200 caracteres)"
          defaultValue={
            solicitud?.detalleSolicitud
          }
          onChange={e => setLargoDetalle(e.target.value.length)}
          aria-describedby="contadorDetalle"
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

        <div
          id="contadorDetalle"
          aria-live="polite"
          className="flex items-center justify-between gap-2 text-[11px]"
        >
          <span className={clsx(
            largoDetalle >= MAXIMO_DETALLE ? "text-red-600" : "text-amber-700",
            largoDetalle < MAXIMO_DETALLE - 20 && "invisible"
          )}>
            {largoDetalle >= MAXIMO_DETALLE
              ? "Llegó al máximo de caracteres"
              : `Quedan ${MAXIMO_DETALLE - largoDetalle} caracteres`}
          </span>
          <span className={clsx(
            "tabular-nums",
            largoDetalle >= MAXIMO_DETALLE ? "font-semibold text-red-600"
              : largoDetalle >= MAXIMO_DETALLE - 20 ? "font-semibold text-amber-700"
                : "text-slate-400"
          )}>
            {largoDetalle}/{MAXIMO_DETALLE}
          </span>
        </div>

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


        <CampoDireccion
          name="direccionTramite"
          defaultValue={solicitud?.direccionTramite}
          onMunicipio={setMunicipioSugerido}
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
          seleccionExterna={municipioSugerido}
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


        {/* En edición la placa / matrícula no se puede modificar */}
        {solicitud?.id ? (

          <div className="
            w-full
            px-3
            py-2.5
            text-xs
            text-slate-500
            bg-slate-50
            border
            border-slate-200
            rounded-md
          ">

            {solicitud.placa
              ? `Placa: ${solicitud.placa}`
              : solicitud.matriculaInmobiliaria
                ? `Matrícula inmobiliaria: ${solicitud.matriculaInmobiliaria}`
                : "Sin placa ni matrícula registrada"}

          </div>

        ) : (<>


        {/* =============================================== */}
        {/* TIPO DE IDENTIFICACIÓN                          */}
        {/* =============================================== */}

        <SelectBuscable
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

        </SelectBuscable>



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

        </>)}

      </div>

{/* ================================================= */}
{/* DOCUMENTOS                                     */}
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