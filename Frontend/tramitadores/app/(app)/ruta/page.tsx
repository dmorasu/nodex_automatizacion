import Link from "next/link"
import { notFound } from "next/navigation"
import { Camera, ChevronLeft, ChevronRight, MapPin, Navigation, Route } from "lucide-react"
import { requiereSesion } from "@/src/auth/sesion"
import { obtenerDatos } from "@/src/lib/api"
import { RutaSchema, type Parada } from "@/src/schemas"
import { enlaceGoogleMaps, enlaceWaze, enlacesRuta } from "@/src/rutas"
import ConfirmarVisita from "@/components/ruta/ConfirmarVisita"
import PanelRuta from "@/components/ruta/PanelRuta"
import IniciarDiligencia from "@/components/ruta/IniciarDiligencia"
import { claseBotonPrimario, claseBotonSecundario, claseTarjeta } from "@/components/ui/estilos"

export const metadata = { title: "Mi ruta" }

const hoyBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
const moverDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10)
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })
const minutosEntre = (desde: string, hasta: string) => Math.max(0, Math.round((Date.parse(hasta) - Date.parse(desde)) / 60_000))
const fechaLarga = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })

const ESTADOS: Record<Parada["estado"], { nombre: string, clase: string }> = {
  PENDIENTE: { nombre: "Pendiente", clase: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  ENTREGADO: { nombre: "Entregado", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  NO_SE_PUDO: { nombre: "No se pudo", clase: "bg-red-50 text-red-700 border-red-200" }
}

// Ruta del día del mensajero: paradas en el orden que definió Torre de control,
// con navegación a Google Maps o Waze y la confirmación de cada visita
export default async function MiRutaPage(props: { searchParams: Promise<{ fecha?: string }> }) {
  const searchParams = await props.searchParams
  const sesion = await requiereSesion()
  if (!sesion.esMensajero) notFound()

  const hoy = hoyBogota()
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.fecha ?? "") ? searchParams.fecha! : hoy
  const ruta = await obtenerDatos(`/ruta?fecha=${fecha}`, RutaSchema)
  if (!ruta) notFound()

  const pendientes = ruta.paradas.filter(p => p.estado === "PENDIENTE")
  const enlaces = enlacesRuta(ruta.sede, pendientes)
  const hechas = ruta.paradas.length - pendientes.length
  const puedeConfirmar = fecha <= hoy
  // Hoy cada diligencia se inicia al llegar y se finaliza al confirmarla (tiempo por diligencia)
  const esHoy = fecha === hoy
  const enCurso = ruta.paradas.find(p => p.estado === "PENDIENTE" && p.inicioDiligencia)
  const motivoNoIniciar = (paradaId: number) =>
    !ruta.jornadaAbierta ? "Inicie la ruta primero"
      : ruta.jornadaAbierta.enAlmuerzo ? "Está en almuerzo"
        : enCurso && enCurso.id !== paradaId ? `Termine primero la diligencia del trámite #${enCurso.tramiteId}`
          : null

  return (
    <div className="space-y-4">
      {/* Día */}
      <div className="flex items-center justify-between gap-2">
        <Link href={`/ruta?fecha=${moverDias(fecha, -1)}`} className="p-2 text-slate-500 active:text-slate-800" aria-label="Día anterior"><ChevronLeft size={22} /></Link>
        <div className="min-w-0 text-center">
          <h1 className="text-lg font-semibold capitalize text-slate-800">{fecha === hoy ? "Hoy" : fechaLarga(fecha)}</h1>
          <p className="text-xs text-slate-500">
            {ruta.paradas.length} parada(s){ruta.paradas.length > 0 && ` · ${hechas} hecha(s)`}
            {ruta.sede && ` · Sale de ${ruta.sede.nombre}`}
          </p>
        </div>
        <Link href={`/ruta?fecha=${moverDias(fecha, 1)}`} className="p-2 text-slate-500 active:text-slate-800" aria-label="Día siguiente"><ChevronRight size={22} /></Link>
      </div>
      {fecha !== hoy && (
        <Link href="/ruta" className="block text-center text-sm font-semibold text-indigo-600">Volver a hoy</Link>
      )}

      {/* Rutas del día: iniciar, almuerzo y finalizar (solo hoy) */}
      {esHoy && <PanelRuta jornadaAbierta={ruta.jornadaAbierta} jornadas={ruta.jornadas} />}

      {/* Toda la ruta en Google Maps */}
      {enlaces.length > 0 && (
        <div className="space-y-2">
          {enlaces.map((enlace, i) => (
            <a key={enlace} href={enlace} target="_blank" rel="noreferrer" className={`${claseBotonPrimario} w-full`}>
              <Route size={18} />
              {enlaces.length > 1 ? `Abrir ruta en Google Maps (tramo ${i + 1} de ${enlaces.length})` : "Abrir ruta completa en Google Maps"}
            </a>
          ))}
        </div>
      )}

      {ruta.paradas.length === 0 ? (
        <div className={`${claseTarjeta} px-5 py-10 text-center text-sm text-slate-500`}>
          No tiene diligencias programadas para este día.
        </div>
      ) : (
        <ol className="space-y-3">
          {ruta.paradas.map(p => (
            <li key={p.id} className={`${claseTarjeta} p-4`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${p.estado === "PENDIENTE" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {p.orden}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/tramites/${p.tramiteId}`} className="text-sm font-semibold text-slate-800 underline-offset-2 active:underline">
                      Trámite #{p.tramiteId}
                    </Link>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ESTADOS[p.estado].clase}`}>{ESTADOS[p.estado].nombre}</span>
                  </div>
                  <p className="text-sm text-slate-600">{p.tipo ?? "—"}</p>
                  <p className="text-sm text-slate-500">{p.cliente ?? "Sin cliente"}{p.placa ? ` · ${p.placa}` : ""}</p>
                  <p className="mt-1 flex items-start gap-1 text-sm text-slate-700">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                    <span>{p.direccion ?? "Sin dirección"}{p.municipio ? `, ${p.municipio}` : ""}</span>
                  </p>
                  {p.detalle && <p className="mt-1 line-clamp-3 text-xs text-slate-500">{p.detalle}</p>}
                  {p.observacion && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{p.observacion}</p>}
                  {p.tieneFoto && (
                    <a href={`/ruta/fotos/${p.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                      <Camera size={13} /> Ver foto
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={enlaceGoogleMaps(p)} target="_blank" rel="noreferrer" className={claseBotonSecundario}>
                  <Navigation size={16} /> Google Maps
                </a>
                <a href={enlaceWaze(p)} target="_blank" rel="noreferrer" className={claseBotonSecundario}>
                  <Navigation size={16} /> Waze
                </a>
              </div>
              {p.inicioDiligencia && (
                <p className="mt-2 text-xs font-semibold text-indigo-700">
                  {p.estado === "PENDIENTE"
                    ? `En curso desde ${hora(p.inicioDiligencia)}`
                    : p.fechaConfirmacion ? `Duró ${minutosEntre(p.inicioDiligencia, p.fechaConfirmacion)} min (${hora(p.inicioDiligencia)} a ${hora(p.fechaConfirmacion)})` : null}
                </p>
              )}
              {esHoy && p.estado === "PENDIENTE" ? (
                <div className="mt-2">
                  {p.inicioDiligencia
                    ? <ConfirmarVisita paradaId={p.id} tramiteId={p.tramiteId} estadoActual={p.estado} textoBoton="Finalizar diligencia" />
                    : <IniciarDiligencia paradaId={p.id} deshabilitado={motivoNoIniciar(p.id)} />}
                </div>
              ) : puedeConfirmar && (
                <div className="mt-2">
                  <ConfirmarVisita paradaId={p.id} tramiteId={p.tramiteId} estadoActual={p.estado} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
