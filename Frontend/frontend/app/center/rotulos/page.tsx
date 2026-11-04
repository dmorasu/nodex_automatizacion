import { Metadata } from "next"
import Link from "next/link"
import { Plus, Printer, Search } from "lucide-react"
import { encabezadosSesion } from "@/src/lib/sesionApi"
import type { RotuloListado } from "@/src/rotulos"
import { formatoFechaFinaizacion } from "@/src/ultis"

export const metadata: Metadata = {
  title: "Nodex - Rótulos de envío",
}

// Rótulos de envío generados (Ayudas Torre de Control): quién, cuándo, a quién y qué trámites.
// ?q= busca por destinatario o por número de trámite
export default async function RotulosPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await props.searchParams
  let rotulos: RotuloListado[] | null = null
  try {
    const req = await fetch(`${process.env.API_URL}/rotulos?limite=100&q=${encodeURIComponent(q)}`, { headers: await encabezadosSesion(), cache: "no-store" })
    rotulos = req.ok ? await req.json() : null
  } catch {
    rotulos = null
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Rótulos de envío</h1>
          <p className="mt-1 text-sm text-slate-400">Los rótulos generados desde Nodex. También se hacen desde el detalle del trámite.</p>
        </div>
        <Link href="/center/rotulos/nuevo" className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white transition hover:bg-sky-700">
          <Plus size={15} /> Nuevo rótulo
        </Link>
      </div>

      <form className="flex max-w-md gap-2" role="search">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input name="q" defaultValue={q} placeholder="Destinatario o número de trámite" aria-label="Buscar rótulos"
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        </div>
        <button className="h-10 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Buscar</button>
      </form>

      {!rotulos ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No se pudieron cargar los rótulos.</p>
      ) : rotulos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">{q ? "No hay rótulos con esa búsqueda." : "Todavía no se han generado rótulos."}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Generado</th>
                <th className="px-4 py-2.5 text-left font-semibold">Envío</th>
                <th className="px-4 py-2.5 text-left font-semibold">Destinatario</th>
                <th className="px-4 py-2.5 text-left font-semibold">Trámites</th>
                <th className="px-4 py-2.5 text-left font-semibold">Contenido</th>
                <th className="px-4 py-2.5 text-left font-semibold">Paga</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rotulos.map(r => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 text-slate-600">
                    {formatoFechaFinaizacion(r.creado)}
                    <span className="block text-[11px] text-slate-400">{r.usuario ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.flujo}
                    <span className="block text-[11px] text-slate-400">{r.transportadora ?? "Sin transportadora"} · {r.tamano === "peq" ? "pequeño" : "carta"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{r.destinatario}</span>
                    <span className="block text-[11px] text-slate-400">{r.ciudad}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {r.tramites.map(t => <Link key={t} href={`/center/solicitudTramites/${t}`} className="font-semibold text-sky-700 hover:underline">#{t}</Link>)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.contenido}</td>
                  <td className="px-4 py-3">
                    <span className={r.paga === "DESTINATARIO" ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700" : "text-slate-600"}>
                      {r.paga === "DESTINATARIO" ? "Destinatario (contraentrega)" : "GPA"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/backend/rotulos/${r.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:underline">
                      <Printer size={13} /> PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
