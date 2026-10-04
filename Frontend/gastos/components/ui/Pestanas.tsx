"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import clsx from "clsx"

// Pestañas por URL. La primera (la raíz de la sección) solo se marca en su ruta exacta.
// Se reparten el ancho (sin scroll horizontal) y los títulos largos se parten en
// varias líneas, centrados horizontal y verticalmente (como "ajustar texto" en Excel).
// En pantallas angostas pasan a varias filas.
export default function Pestanas({ pestanas }: { pestanas: { href: string, nombre: string }[] }) {
  const pathname = usePathname()
  const raiz = pestanas[0]?.href

  return (
    <nav className="flex flex-wrap border-b border-slate-200 sm:flex-nowrap">
      {pestanas.map(({ href, nombre }) => {
        // "/legalizacion/reintegros" no debe marcarse en "/legalizacion/reintegros-tramitador"
        const activa = href === raiz ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={clsx(
              "-mb-px flex min-h-[3rem] min-w-0 basis-1/3 items-center justify-center border-b-2 px-2 py-2 text-center text-xs font-semibold leading-tight transition sm:flex-1 sm:basis-0",
              activa
                ? "border-emerald-600 bg-emerald-50/60 text-emerald-700"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <span className="text-balance">{nombre}</span>
          </Link>
        )
      })}
    </nav>
  )
}
