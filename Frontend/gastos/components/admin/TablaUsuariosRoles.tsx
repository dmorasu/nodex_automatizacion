"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Search, Save } from "lucide-react"
import { asignarRoles } from "@/actions/admin/asignarRoles"
import type { Rol, UsuarioConRoles } from "@/src/schemas/admin"

function FilaUsuario({ usuario, roles }: { usuario: UsuarioConRoles, roles: Rol[] }) {
  // Solo los perfiles de Gastos que muestra la tabla (los de Trámites no se envían)
  const inicial = usuario.roles.map(rol => rol.codigo).filter(codigo => roles.some(r => r.codigo === codigo))
  const [seleccionados, setSeleccionados] = useState<string[]>(inicial)
  const [guardando, startTransition] = useTransition()

  const huboCambios =
    seleccionados.length !== inicial.length ||
    seleccionados.some(codigo => !inicial.includes(codigo))

  const alternar = (codigo: string) =>
    setSeleccionados(actuales =>
      actuales.includes(codigo)
        ? actuales.filter(c => c !== codigo)
        : [...actuales, codigo]
    )

  const guardar = () =>
    startTransition(async () => {
      const resultado = await asignarRoles(usuario.id, seleccionados)

      if (resultado.ok) {
        toast.success(`Roles de ${usuario.nombreUsuario} actualizados`)
      } else {
        toast.error(resultado.error)
      }
    })

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3">
        <p className="text-xs font-medium text-slate-700">{usuario.nombreUsuario}</p>
        <p className="text-[11px] text-slate-400">{usuario.correoUsuario}</p>
      </td>

      {roles.map(rol => (
        <td key={rol.codigo} className="px-4 py-3 text-center">
          <input
            type="checkbox"
            aria-label={`${rol.nombre} para ${usuario.nombreUsuario}`}
            checked={seleccionados.includes(rol.codigo)}
            onChange={() => alternar(rol.codigo)}
            className="h-4 w-4 accent-emerald-600"
          />
        </td>
      ))}

      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={guardar}
          disabled={!huboCambios || guardando}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md
            bg-emerald-600 text-white text-[11px] font-semibold transition
            hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed
          "
        >
          <Save size={13} />
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </td>
    </tr>
  )
}

export default function TablaUsuariosRoles({ usuarios, roles }: { usuarios: UsuarioConRoles[], roles: Rol[] }) {
  const [busqueda, setBusqueda] = useState("")

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return usuarios

    return usuarios.filter(usuario =>
      usuario.nombreUsuario.toLowerCase().includes(texto) ||
      usuario.correoUsuario.toLowerCase().includes(texto)
    )
  }, [usuarios, busqueda])

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

      <div className="p-4 border-b border-slate-200">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-200 text-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usuario</th>
              {roles.map(rol => (
                <th key={rol.codigo} className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {rol.nombre}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map(usuario => (
              <FilaUsuario key={usuario.id} usuario={usuario} roles={roles} />
            ))}
          </tbody>
        </table>

        {filtrados.length === 0 && (
          <p className="py-10 text-center text-xs text-slate-400">No hay usuarios que coincidan con la búsqueda.</p>
        )}
      </div>

    </div>
  )
}
