import Link from "next/link";
import clsx from "clsx";
import { CircleCheck, Clock, Lock, Unlock } from "lucide-react";

// Lo que devuelve GET /solicitudTramites/:id/dependencia-envio (services/dependenciaEnvio.ts)
export type EstadoDependenciaEnvio = {
  dependeEnvio: boolean
  envio: { id: number, tipo: string, estado: string, finalizado: boolean, finalizadoEl: string | null } | null
  envioFinalizado: boolean
  gastos: { codigo: string, estado: string, pagado: boolean, fechaPago: string | null }[]
  pagoCompleto: boolean
  pagadoEl: string | null
  cumplidasEn: string | null
  puedeProgramar: boolean
  faltantes: string[]
}

export const obtenerDependenciaEnvio = async (solicitudTramiteId: number, token: string): Promise<EstadoDependenciaEnvio | null> => {
  try {
    const respuesta = await fetch(`${process.env.API_URL}/solicitudTramites/${solicitudTramiteId}/dependencia-envio`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
    return respuesta.ok ? await respuesta.json() : null;
  } catch {
    return null;
  }
};

const fechaCorta = (fecha: string | null) => {
  if (!fecha) return "";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function Condicion({ cumplida, titulo, children }: { cumplida: boolean, titulo: string, children: React.ReactNode }) {
  const Icono = cumplida ? CircleCheck : Clock;
  return (
    <div className="flex items-start gap-2">
      <Icono size={15} className={clsx("mt-0.5 shrink-0", cumplida ? "text-emerald-600" : "text-amber-600")} />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-slate-700">{titulo}</p>
        <div className="text-[11px] text-slate-500">{children}</div>
      </div>
    </div>
  );
}

// Envío de documentos del que depende el trámite: el envío, el pago y si ya se puede programar
export default function EnvioDocumentosTramite({ estado }: { estado: EstadoDependenciaEnvio }) {
  const { envio, gastos } = estado;
  return (
    <div className="space-y-3">
      <div className={clsx(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
        estado.puedeProgramar ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"
      )}>
        {estado.puedeProgramar ? <Unlock size={14} /> : <Lock size={14} />}
        {estado.puedeProgramar
          ? `Se puede programar${estado.cumplidasEn ? ` desde el ${fechaHora(estado.cumplidasEn)}` : ""}`
          : "No se puede programar todavía"}
      </div>

      <Condicion cumplida={estado.envioFinalizado} titulo="Envío finalizado">
        {envio ? (
          <>
            <Link href={`/center/solicitudTramites/${envio.id}`} className="font-semibold text-sky-700 hover:underline">#{envio.id}</Link>
            {" · "}{envio.estado}{envio.finalizadoEl ? ` el ${fechaCorta(envio.finalizadoEl)}` : ""}
            <span className="block truncate text-slate-400">{envio.tipo}</span>
          </>
        ) : (
          <span className="text-amber-700">Sin envío relacionado: elíjalo en Editar trámite</span>
        )}
      </Condicion>

      <Condicion cumplida={estado.pagoCompleto} titulo="Pago confirmado">
        {gastos.length === 0 ? (
          <span className="text-amber-700">El trámite no tiene gastos</span>
        ) : (
          <ul className="space-y-0.5">
            {gastos.map(g => (
              <li key={g.codigo}>
                {g.codigo} · <span className={g.pagado ? "text-emerald-700" : "text-amber-700"}>{g.estado}</span>
                {g.fechaPago ? ` el ${fechaCorta(g.fechaPago)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Condicion>
    </div>
  );
}
