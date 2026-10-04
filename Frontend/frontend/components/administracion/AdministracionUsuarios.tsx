"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Save, Search, X } from "lucide-react"
import {
  actualizarUsuario,
  asignarPerfiles,
  crearUsuario,
  restablecerContrasena
} from "@/actions/administracion-action"

export type Rol = { id: number, codigo: string, nombre: string }
export type UsuarioAdmin = {
  id: number
  nombreUsuario: string
  correoUsuario: string
  area: string | null
  roles: { codigo: string }[]
}

// Los perfiles se muestran agrupados por módulo
const GRUPOS = [
  { titulo: "Trámites", codigos: ["GESTION_ACTIVOS", "TORRE_CONTROL", "ANALISTA_TRAMITES", "ADMIN_TORRE_CONTROL"] },
  { titulo: "Gastos", codigos: ["TESORERIA", "LEGALIZACION", "CONTABILIDAD"] },
  { titulo: "General", codigos: ["ADMIN"] }
]

const claseInput = `
  w-full h-10 px-3 rounded-md border border-slate-200 bg-white
  text-xs text-slate-700 placeholder:text-slate-300 outline-none transition
  focus:border-sky-400 focus:ring-2 focus:ring-sky-100
`
const claseLabel = "block mb-1.5 text-xs font-medium text-slate-600"
const botonPrimario = "inline-flex items-center gap-2 h-10 px-4 rounded-md bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-50"
const botonSecundario = "h-10 px-4 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50"

type Resultado = { ok: true } | { ok: false, errores: string[] }

// Ejecuta una acción y muestra el resultado
const useAccion = () => {
  const [procesando, start] = useTransition()
  const ejecutar = (accion: () => Promise<Resultado>, exito: string, alTerminar?: () => void) =>
    start(async () => {
      const resultado = await accion()
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(exito)
      alTerminar?.()
    })
  return { procesando, ejecutar }
}

function Ventana({ titulo, onCerrar, children, pie }: {
  titulo: string
  onCerrar: () => void
  children: React.ReactNode
  pie: React.ReactNode
}) {
  return (
    <Dialog open onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-sm font-semibold text-slate-800">{titulo}</DialogTitle>
              <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">{children}</div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">{pie}</div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

// Campo de contraseña con botón para mostrarla
function CampoContrasena({ etiqueta, valor, onChange }: { etiqueta: string, valor: string, onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="block">
      <span className={claseLabel}>{etiqueta} <span className="text-red-400">*</span></span>
      <div className="relative">
        <input type={visible ? "text" : "password"} value={valor} onChange={e => onChange(e.target.value)} autoComplete="new-password" className={`${claseInput} pr-10`} />
        <button type="button" onClick={() => setVisible(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={visible ? "Ocultar" : "Mostrar"}>
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  )
}

const validarContrasenas = (contrasena: string, confirmacion: string) => {
  if (contrasena.length < 8) return "La contraseña debe tener mínimo 8 caracteres"
  if (contrasena !== confirmacion) return "Las contraseñas no coinciden"
  return null
}

// ── Crear o editar usuario ─────────────────────────────

function ModalUsuario({ usuario, roles, onCerrar }: { usuario: UsuarioAdmin | null, roles: Rol[], onCerrar: () => void }) {
  const [datos, setDatos] = useState({
    nombreUsuario: usuario?.nombreUsuario ?? "",
    correoUsuario: usuario?.correoUsuario ?? "",
    area: usuario?.area ?? ""
  })
  const [contrasena, setContrasena] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [perfiles, setPerfiles] = useState<string[]>([])
  const { procesando, ejecutar } = useAccion()

  const guardar = () => {
    if (usuario) {
      return ejecutar(() => actualizarUsuario(usuario.id, datos), "Usuario actualizado", onCerrar)
    }
    const error = validarContrasenas(contrasena, confirmacion)
    if (error) return toast.error(error)
    ejecutar(() => crearUsuario({ ...datos, contrasena, roles: perfiles }), `Usuario ${datos.nombreUsuario} creado`, onCerrar)
  }

  return (
    <Ventana
      titulo={usuario ? `Editar ${usuario.nombreUsuario}` : "Nuevo usuario"}
      onCerrar={() => !procesando && onCerrar()}
      pie={<>
        <button type="button" onClick={onCerrar} disabled={procesando} className={botonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={procesando} className={botonPrimario}>
          {procesando && <Loader2 size={15} className="animate-spin" />}
          {usuario ? "Guardar cambios" : "Crear usuario"}
        </button>
      </>}
    >
      <label className="block">
        <span className={claseLabel}>Nombre <span className="text-red-400">*</span></span>
        <input value={datos.nombreUsuario} onChange={e => setDatos({ ...datos, nombreUsuario: e.target.value })} maxLength={100} className={claseInput} autoFocus />
      </label>
      <label className="block">
        <span className={claseLabel}>Correo (usuario para ingresar) <span className="text-red-400">*</span></span>
        <input type="email" value={datos.correoUsuario} onChange={e => setDatos({ ...datos, correoUsuario: e.target.value })} maxLength={100} className={claseInput} />
      </label>
      <label className="block">
        <span className={claseLabel}>Área</span>
        <input value={datos.area} onChange={e => setDatos({ ...datos, area: e.target.value })} maxLength={100} className={claseInput} />
      </label>

      {!usuario && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoContrasena etiqueta="Contraseña" valor={contrasena} onChange={setContrasena} />
            <CampoContrasena etiqueta="Confirmar contraseña" valor={confirmacion} onChange={setConfirmacion} />
          </div>
          <p className="-mt-2 text-[11px] text-slate-400">Mínimo 8 caracteres. Comparta la contraseña con el usuario por un medio seguro.</p>

          <div>
            <p className={claseLabel}>Perfiles</p>
            <div className="space-y-2">
              {GRUPOS.map(grupo => (
                <div key={grupo.titulo} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{grupo.titulo}</span>
                  {roles.filter(r => grupo.codigos.includes(r.codigo)).map(rol => (
                    <label key={rol.codigo} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={perfiles.includes(rol.codigo)}
                        onChange={() => setPerfiles(p => p.includes(rol.codigo) ? p.filter(c => c !== rol.codigo) : [...p, rol.codigo])}
                        className="h-4 w-4 accent-sky-500"
                      />
                      {rol.nombre}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Ventana>
  )
}

// ── Restablecer contraseña ─────────────────────────────

function ModalContrasena({ usuario, onCerrar }: { usuario: UsuarioAdmin, onCerrar: () => void }) {
  const [contrasena, setContrasena] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const { procesando, ejecutar } = useAccion()

  const guardar = () => {
    const error = validarContrasenas(contrasena, confirmacion)
    if (error) return toast.error(error)
    ejecutar(() => restablecerContrasena(usuario.id, contrasena), `Contraseña de ${usuario.nombreUsuario} restablecida`, onCerrar)
  }

  return (
    <Ventana
      titulo={`Restablecer contraseña · ${usuario.nombreUsuario}`}
      onCerrar={() => !procesando && onCerrar()}
      pie={<>
        <button type="button" onClick={onCerrar} disabled={procesando} className={botonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={procesando} className={botonPrimario}>
          {procesando && <Loader2 size={15} className="animate-spin" />}
          Restablecer
        </button>
      </>}
    >
      <p className="text-xs text-slate-500">
        La contraseña actual de <b>{usuario.correoUsuario}</b> deja de funcionar. Comparta la nueva con el usuario por un medio seguro.
      </p>
      <CampoContrasena etiqueta="Nueva contraseña" valor={contrasena} onChange={setContrasena} />
      <CampoContrasena etiqueta="Confirmar contraseña" valor={confirmacion} onChange={setConfirmacion} />
    </Ventana>
  )
}

// ── Fila de usuario con sus perfiles ───────────────────

function FilaUsuario({ usuario, roles, esUsted, onEditar, onContrasena }: {
  usuario: UsuarioAdmin
  roles: Rol[]
  esUsted: boolean
  onEditar: () => void
  onContrasena: () => void
}) {
  const inicial = usuario.roles.map(r => r.codigo)
  const [seleccion, setSeleccion] = useState<string[]>(inicial)
  const { procesando, ejecutar } = useAccion()

  const huboCambios = seleccion.length !== inicial.length || seleccion.some(c => !inicial.includes(c))
  const sinPerfilTramites = !seleccion.some(c => ["GESTION_ACTIVOS", "TORRE_CONTROL", "ANALISTA_TRAMITES", "ADMIN_TORRE_CONTROL", "ADMIN"].includes(c))

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="text-xs font-medium text-slate-700">{usuario.nombreUsuario}{esUsted && <span className="ml-1 text-[10px] text-sky-600">(usted)</span>}</p>
        <p className="text-[11px] text-slate-400">{usuario.correoUsuario}{usuario.area && ` · ${usuario.area}`}</p>
        {sinPerfilTramites && <p className="mt-0.5 text-[10px] text-amber-600">Sin acceso a trámites</p>}
      </td>

      {roles.map(rol => (
        <td key={rol.codigo} className="px-3 py-3 text-center">
          <input
            type="checkbox"
            aria-label={`${rol.nombre} para ${usuario.nombreUsuario}`}
            checked={seleccion.includes(rol.codigo)}
            onChange={() => setSeleccion(s => s.includes(rol.codigo) ? s.filter(c => c !== rol.codigo) : [...s, rol.codigo])}
            className="h-4 w-4 accent-sky-500"
          />
        </td>
      ))}

      <td className="px-4 py-3 whitespace-nowrap text-right">
        <button
          type="button"
          onClick={() => ejecutar(() => asignarPerfiles(usuario.id, seleccion), `Perfiles de ${usuario.nombreUsuario} actualizados`)}
          disabled={!huboCambios || procesando}
          className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-600 disabled:opacity-30"
        >
          {procesando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Guardar
        </button>
        <button type="button" onClick={onEditar} className="ml-1 p-1.5 text-slate-400 hover:text-sky-600" aria-label={`Editar ${usuario.nombreUsuario}`} title="Editar datos">
          <Pencil size={15} />
        </button>
        <button type="button" onClick={onContrasena} className="p-1.5 text-slate-400 hover:text-amber-600" aria-label={`Restablecer contraseña de ${usuario.nombreUsuario}`} title="Restablecer contraseña">
          <KeyRound size={15} />
        </button>
      </td>
    </tr>
  )
}

// ── Pantalla ───────────────────────────────────────────

export default function AdministracionUsuarios({ usuarios, roles, usuarioActualId }: {
  usuarios: UsuarioAdmin[]
  roles: Rol[]
  usuarioActualId: number
}) {
  const [busqueda, setBusqueda] = useState("")
  // undefined = cerrado | null = nuevo
  const [editando, setEditando] = useState<UsuarioAdmin | null | undefined>(undefined)
  const [contrasena, setContrasena] = useState<UsuarioAdmin | null>(null)

  // Columnas en el orden de los grupos
  const rolesOrdenados = GRUPOS.flatMap(g => g.codigos).map(c => roles.find(r => r.codigo === c)).filter(Boolean) as Rol[]

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return usuarios
    return usuarios.filter(u => [u.nombreUsuario, u.correoUsuario, u.area].some(v => v?.toLowerCase().includes(texto)))
  }, [usuarios, busqueda])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, correo o área" className={`${claseInput} pl-9`} aria-label="Buscar usuario" />
        </div>
        <button type="button" onClick={() => setEditando(null)} className={botonPrimario}>
          <Plus size={15} />
          Nuevo usuario
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-[10px] uppercase tracking-wide text-slate-400">
              <th />
              {GRUPOS.map(g => (
                <th key={g.titulo} colSpan={g.codigos.filter(c => roles.some(r => r.codigo === c)).length} className="px-3 pt-2 text-center font-semibold">
                  {g.titulo}
                </th>
              ))}
              <th />
            </tr>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Usuario</th>
              {rolesOrdenados.map(r => <th key={r.codigo} className="px-3 py-3 text-center font-semibold">{r.nombre}</th>)}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map(u => (
              <FilaUsuario
                key={`${u.id}-${u.roles.map(r => r.codigo).join(",")}`}
                usuario={u}
                roles={rolesOrdenados}
                esUsted={u.id === usuarioActualId}
                onEditar={() => setEditando(u)}
                onContrasena={() => setContrasena(u)}
              />
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No hay usuarios que coincidan.</p>}
      </div>

      {editando !== undefined && (
        <ModalUsuario key={editando?.id ?? "nuevo"} usuario={editando} roles={rolesOrdenados} onCerrar={() => setEditando(undefined)} />
      )}
      {contrasena && <ModalContrasena usuario={contrasena} onCerrar={() => setContrasena(null)} />}
    </div>
  )
}
