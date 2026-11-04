"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Loader2, PackageCheck } from "lucide-react";

// Envío de documentos que se puede relacionar (GET /solicitudTramites/envios-relacionables)
type Envio = {
  id: number
  tipo: string
  estado: string
  finalizado: boolean
  finalizadoEl: string | null
  creadoEl: string
  cliente: string | null
}

const fechaCorta = (fecha: string | null) => {
  if (!fecha) return ""
  const [anio, mes, dia] = fecha.split("-")
  return `${dia}/${mes}/${anio}`
}

// "¿Depende de envío de documentos?" (Sí / No). Con Sí, lista los envíos de la placa o matrícula
// del trámite para elegir el que queda relacionado; se puede dejar sin elegir y relacionarlo al editar.
// Mientras el envío no esté Finalizado y los gastos pagados, el trámite no se puede programar.
export default function DependenciaEnvio({
  placa,
  matricula,
  excluirId,
  dependeInicial = false,
  envioInicial = null
}: {
  placa?: string | null
  matricula?: string | null
  excluirId?: number
  dependeInicial?: boolean
  envioInicial?: number | null
}) {
  const [depende, setDepende] = useState(dependeInicial);
  const [envioId, setEnvioId] = useState<number | null>(envioInicial);
  // Resultado con la búsqueda que lo produjo: si la placa cambió, no se muestra el anterior
  const [resultado, setResultado] = useState<{ clave: string, lista: Envio[] } | null>(null);

  const identificador = (placa ?? "").trim() || (matricula ?? "").trim();
  const claveBusqueda = `${(placa ?? "").trim()}|${(matricula ?? "").trim()}`;
  const envios = resultado?.clave === claveBusqueda ? resultado.lista : null;

  // Los envíos se buscan cuando se marca Sí y cada vez que cambia la placa (con una pausa al escribir)
  useEffect(() => {
    if (!depende || !identificador) return;
    const control = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const parametros = new URLSearchParams();
        if ((placa ?? "").trim()) parametros.set("placa", placa!.trim());
        if ((matricula ?? "").trim()) parametros.set("matricula", matricula!.trim());
        if (excluirId) parametros.set("excluir", String(excluirId));
        const respuesta = await fetch(`/api/backend/solicitudTramites/envios-relacionables?${parametros}`, { signal: control.signal });
        const lista: Envio[] = respuesta.ok ? await respuesta.json() : [];
        setResultado({ clave: claveBusqueda, lista });
        // El elegido ya no está en la lista (cambió la placa): se quita
        setEnvioId(actual => (actual && lista.some(e => e.id === actual) ? actual : null));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResultado({ clave: claveBusqueda, lista: [] });
      }
    }, 400);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [depende, identificador, claveBusqueda, placa, matricula, excluirId]);

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-slate-600">¿Depende de envío de documentos?</span>

      {/* Viajan con el formulario */}
      <input type="hidden" name="dependeEnvio" value={depende ? "si" : "no"} />
      <input type="hidden" name="envioTramiteId" value={depende && envioId ? String(envioId) : ""} />

      <div role="radiogroup" aria-label="¿Depende de envío de documentos?" className="grid grid-cols-2 gap-2">
        {([[true, "Sí"], [false, "No"]] as const).map(([valor, texto]) => (
          <button
            key={texto}
            type="button"
            role="radio"
            aria-checked={depende === valor}
            onClick={() => setDepende(valor)}
            className={clsx(
              "h-10 px-3 text-xs font-medium border rounded-md transition focus:outline-none focus:ring-2 focus:ring-sky-100",
              depende === valor
                ? "bg-sky-50 text-sky-700 border-sky-400"
                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      {depende && (
        !identificador ? (
          <p className="text-[11px] text-amber-700">Escriba la placa o la matrícula para ver sus envíos.</p>
        ) : envios === null ? (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400"><Loader2 size={12} className="animate-spin" /> Buscando envíos…</p>
        ) : envios && envios.length === 0 ? (
          <p className="text-[11px] text-amber-700">No hay envíos de documentos de {identificador}. El envío se relaciona después, al editar el trámite.</p>
        ) : envios ? (
          <ul role="radiogroup" aria-label="Envío relacionado" className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {envios.map(envio => {
              const elegido = envioId === envio.id;
              return (
                <li key={envio.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => setEnvioId(elegido ? null : envio.id)}
                    className={clsx(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-xs transition",
                      elegido ? "bg-sky-50" : "hover:bg-slate-50"
                    )}
                  >
                    <span className={clsx(
                      "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                      elegido ? "border-sky-500" : "border-slate-300"
                    )}>
                      {elegido && <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-slate-700">#{envio.id}</span>
                        <span className={clsx(
                          "rounded border px-1.5 py-px text-[10px] font-medium",
                          envio.finalizado ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                        )}>
                          {envio.estado}{envio.finalizadoEl ? ` · ${fechaCorta(envio.finalizadoEl)}` : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-slate-500">{envio.tipo}</span>
                      <span className="block text-[11px] text-slate-400">
                        Creado el {fechaCorta(envio.creadoEl)}{envio.cliente ? ` · ${envio.cliente}` : ""}
                      </span>
                    </span>
                    <PackageCheck size={14} className={clsx("mt-0.5 shrink-0", elegido ? "text-sky-500" : "text-slate-300")} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null
      )}
    </div>
  );
}
