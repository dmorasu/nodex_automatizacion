import Link from "next/link"
import {
  ArrowUpRight,
  BarChart3,
  Calculator,
  FileCheck2,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Settings2,
  Users,
  BadgeCheck,
  HandCoins,
  ListChecks,
  type LucideIcon
} from "lucide-react"
import { obtenerSesion } from "@/src/auth/dal"
import { NOMBRES_ROL, ROLES, modulosPermitidos, tieneAcceso } from "@/src/auth/permisos"
import { fetchApi } from "@/src/lib/api"

// Aspecto de cada módulo. Las clases van completas (Tailwind solo genera las que lee literalmente).
const ASPECTO: Record<string, { Icono: LucideIcon, fondo: string, sombra: string, borde: string, halo: string }> = {
  "/solicitudes": { Icono: Receipt, fondo: "from-emerald-400 to-teal-600", sombra: "shadow-emerald-500/30", borde: "hover:border-emerald-300", halo: "bg-emerald-400" },
  "/anticipos": { Icono: HandCoins, fondo: "from-cyan-400 to-sky-600", sombra: "shadow-cyan-500/30", borde: "hover:border-cyan-300", halo: "bg-cyan-400" },
  "/tesoreria": { Icono: Landmark, fondo: "from-sky-400 to-blue-600", sombra: "shadow-sky-500/30", borde: "hover:border-sky-300", halo: "bg-sky-400" },
  "/direccion": { Icono: BadgeCheck, fondo: "from-teal-400 to-emerald-600", sombra: "shadow-teal-500/30", borde: "hover:border-teal-300", halo: "bg-teal-400" },
  "/legalizacion": { Icono: FileCheck2, fondo: "from-violet-400 to-purple-600", sombra: "shadow-violet-500/30", borde: "hover:border-violet-300", halo: "bg-violet-400" },
  "/contabilidad": { Icono: Calculator, fondo: "from-amber-400 to-orange-500", sombra: "shadow-amber-500/30", borde: "hover:border-amber-300", halo: "bg-amber-400" },
  "/tablero": { Icono: BarChart3, fondo: "from-indigo-400 to-indigo-600", sombra: "shadow-indigo-500/30", borde: "hover:border-indigo-300", halo: "bg-indigo-400" },
  "/reportes": { Icono: FileSpreadsheet, fondo: "from-teal-400 to-cyan-600", sombra: "shadow-teal-500/30", borde: "hover:border-teal-300", halo: "bg-teal-400" },
  "/admin": { Icono: Settings2, fondo: "from-slate-500 to-slate-700", sombra: "shadow-slate-500/30", borde: "hover:border-slate-400", halo: "bg-slate-400" },
  "/usuarios": { Icono: Users, fondo: "from-rose-400 to-pink-600", sombra: "shadow-rose-500/30", borde: "hover:border-rose-300", halo: "bg-rose-400" },
  "/catalogos": { Icono: ListChecks, fondo: "from-lime-400 to-green-600", sombra: "shadow-lime-500/30", borde: "hover:border-lime-300", halo: "bg-lime-400" }
}

const ASPECTO_POR_DEFECTO = ASPECTO["/admin"]

// Cuántos reembolsos de caja menor hay en un estado
const contarReembolsos = async (estado: string) => {
  const req = await fetchApi(`/gastos/caja-menor/reembolsos?estado=${estado}&tamano=1`)
  if (!req.ok) return 0
  return Number((await req.json()).total ?? 0)
}

// Cuántos gastos cumplen un filtro (solo se pide el total)
const contar = async (filtros: Record<string, string>) => {
  const req = await fetchApi(`/gastos/solicitudes?${new URLSearchParams({ ...filtros, tamano: "1" })}`)
  if (!req.ok) return 0
  return Number((await req.json()).total ?? 0)
}

const contarSoportes = async (reembolsable: "si" | "no") => {
  const req = await fetchApi(`/gastos/soportes-tramitador?estado=PENDIENTE&reembolsable=${reembolsable}`)
  if (!req.ok) return 0
  return ((await req.json()) as unknown[]).length
}

type Pendiente = { cantidad: number, texto: string }

// Lo que tiene pendiente cada módulo, solo para los módulos a los que el usuario entra
const pendientesPorModulo = async (roles: string[]): Promise<Record<string, Pendiente[]>> => {
  const puede = (rol: (typeof ROLES)[keyof typeof ROLES]) => tieneAcceso(roles, [rol])

  // Anticipos: con novedad y confirmados sin gasto (los propios); por confirmar y solicitudes por facturar (Contabilidad)
  const anticipos = fetchApi("/gastos/anticipos/resumen")
    .then(async req => req.ok ? await req.json() as { porConfirmar: number, porFacturar?: number, conNovedad: number, confirmadosSinGasto: number } : null)
    .catch(() => null)

  const consultas: [string, string, Promise<number>][] = [
    ["/solicitudes", "por pagar", contar({ alcance: "mios", estado: "SOLICITADO" })],
    ["/anticipos", "con novedad por corregir", anticipos.then(r => r?.conNovedad ?? 0)],
    ["/anticipos", "confirmados para crear el gasto", anticipos.then(r => r?.confirmadosSinGasto ?? 0)]
  ]
  if (puede(ROLES.TESORERIA)) {
    consultas.push(
      ["/tesoreria", "por programar", contar({ alcance: "todos", estado: "SOLICITADO", certificados: "no", anticipo: "no", cajaMenor: "no" })],
      ["/tesoreria", "de anticipos por pagar", contar({ alcance: "todos", estado: "SOLICITADO", anticipo: "si" })],
      ["/tesoreria", "aprobados por confirmar", contar({ alcance: "todos", estado: "APROBADO_PAGO", certificados: "no" })]
    )
  }
  // Caja menor: Tesorería ve todas las cajas; la auxiliar, solo la suya (lo limita el backend)
  if (puede(ROLES.TESORERIA) || roles.includes(ROLES.AUXILIAR_TESORERIA_CAJA)) {
    consultas.push(
      ["/tesoreria", "por pagar en caja menor", contar({ alcance: "todos", estado: "SOLICITADO", cajaMenor: "si" })],
      ["/tesoreria", "por legalizar en caja menor", contar({ alcance: "todos", estado: "PAGADO_CAJA", cajaMenor: "si" })]
    )
  }
  if (puede(ROLES.DIRECCION_NEGOCIO)) {
    consultas.push(
      ["/direccion", "por aprobar", contar({ alcance: "todos", estado: "PROGRAMADO" })],
      ["/direccion", "reembolsos de caja menor por aprobar", contarReembolsos("POR_APROBAR")]
    )
  }
  if (puede(ROLES.TESORERIA_CERTIFICADOS)) {
    consultas.push(["/tesoreria", "certificados por pagar", contar({ alcance: "todos", estado: "SOLICITADO", certificados: "si", anticipo: "no" })])
  }
  if (puede(ROLES.LEGALIZACION)) {
    consultas.push(
      ["/legalizacion", "soportes por revisar", contarSoportes("si")],
      ["/legalizacion", "facturas por registrar", contar({ alcance: "todos", estado: "PAGADO", reembolsable: "si", soporteTramitador: "si" })],
      ["/legalizacion", "para cuenta de cobro", contar({ alcance: "todos", estado: "FACTURADO", reembolsable: "si" })]
    )
  }
  if (puede(ROLES.CONTABILIDAD)) {
    consultas.push(
      ["/contabilidad", "anticipos por confirmar", anticipos.then(r => r?.porConfirmar ?? 0)],
      ["/contabilidad", "solicitudes por facturar", anticipos.then(r => r?.porFacturar ?? 0)],
      ["/contabilidad", "no reembolsables sin factura", contar({ alcance: "todos", estado: "PAGADO", reembolsable: "no" })],
      ["/contabilidad", "por contabilizar", contar({ alcance: "todos", estado: "LEGALIZADO", reembolsable: "no", sinCuentaCobro: "si" })]
    )
  }

  const resultados = await Promise.allSettled(consultas.map(([, , promesa]) => promesa))
  const pendientes: Record<string, Pendiente[]> = {}

  consultas.forEach(([href, texto], i) => {
    const resultado = resultados[i]
    if (resultado.status === "fulfilled" && resultado.value > 0) {
      (pendientes[href] ??= []).push({ cantidad: resultado.value, texto })
    }
  })
  return pendientes
}

const saludo = () => {
  const hora = Number(new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false }))
  return hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
}

export default async function InicioPage() {
  const sesion = await obtenerSesion()
  const modulos = modulosPermitidos(sesion.roles)
  const pendientes = await pendientesPorModulo(sesion.roles)

  const hoy = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" })
  const primerNombre = sesion.nombreUsuario.split(" ")[0]
  const totalPendientes = Object.values(pendientes).flat().reduce((s, p) => s + p.cantidad, 0)

  return (
    <div className="space-y-8">

      {/* SALUDO */}
      <section className="aparecer relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 px-6 py-7 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden="true" />

        <div className="relative">
          <p className="text-xs font-medium capitalize text-emerald-100/80">{hoy}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{saludo()}, {primerNombre}</h1>
          <p className="mt-2 text-sm text-emerald-50/80">
            {totalPendientes > 0
              ? <>Tienes <b className="text-white">{totalPendientes}</b> pendiente(s) en tus módulos.</>
              : "Todo al día en tus módulos."}
          </p>

          {sesion.roles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {sesion.roles.map(rol => (
                <span key={rol} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur">
                  {NOMBRES_ROL[rol] ?? rol}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MÓDULOS */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Tus módulos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((modulo, i) => {
            const { Icono, fondo, sombra, borde, halo } = ASPECTO[modulo.href] ?? ASPECTO_POR_DEFECTO
            const suyos = pendientes[modulo.href] ?? []

            return (
              <Link
                key={modulo.href}
                href={modulo.href}
                style={{ animationDelay: `${80 + i * 60}ms` }}
                className={`aparecer group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${borde}`}
              >
                {/* Halo de color que aparece al pasar el mouse */}
                <span className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition duration-500 group-hover:opacity-30 ${halo}`} aria-hidden="true" />

                <div className="relative flex items-start justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition duration-300 group-hover:-rotate-6 group-hover:scale-110 ${fondo} ${sombra}`}>
                    <Icono size={22} strokeWidth={2} />
                  </span>
                  <ArrowUpRight size={18} className="text-slate-300 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-600" />
                </div>

                <h3 className="relative mt-4 text-base font-semibold text-slate-800">{modulo.nombre}</h3>
                <p className="relative mt-1 text-xs leading-5 text-slate-500">{modulo.descripcion}</p>

                {/* Pendientes en vivo */}
                {suyos.length > 0 && (
                  <ul className="relative mt-4 flex flex-wrap gap-1.5">
                    {suyos.map(p => (
                      <li key={p.texto} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        <span className="latido h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                        {p.cantidad} {p.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
