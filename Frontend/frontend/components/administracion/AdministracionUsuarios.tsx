"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "react-toastify"
import { errorContrasena } from "@/src/auth/politicaContrasena"
import RequisitosContrasena from "@/components/auth/RequisitosContrasena"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { ChevronLeft, ChevronRight, Eye, EyeOff, KeyRound, Loader2, LockOpen, Pencil, Plus, Save, Search, X } from "lucide-react"
import {
  actualizarUsuario,
  asignarPerfiles,
  crearUsuario,
  desbloquearUsuario,
  restablecerContrasena
} from "@/actions/administracion-action"

export type Rol = { id: number, codigo: string, nombre: string }
export type Area = { id: number, nombre: string }
export type UsuarioAdmin = {
  id: number
  nombreUsuario: string
  correoUsuario: string
  area: string | null
  areaId: number | null
  roles: { codigo: string }[]
  // Minutos que le faltan para poder entrar tras varios intentos fallidos (0 = no está bloqueado)
  minutosBloqueo?: number
}

// Los perfiles se muestran agrupados por módulo
const GRUPOS = [
  { titulo: "Trámites", codigos: ["GESTION_ACTIVOS", "TORRE_CONTROL", "ANALISTA_TRAMITES", "ADMIN_TORRE_CONTROL"] },
  { titulo: "Gastos", codigos: ["TESORERIA", "TESORERIA_CERTIFICADOS", "DIRECCION_NEGOCIO", "LEGALIZACION", "CONTABILIDAD"] },
  { titulo: "General", codigos: ["ADMIN"] }
]

// Perfiles que dan entrada a Nodex Trámites
const PERFILES_TRAMITES = ["GESTION_ACTIVOS", "TORRE_CONTROL", "ANALISTA_TRAMITES", "ADMIN_TORRE_CONTROL", "ADMIN"]

const TAMANO_PAGINA = 15

// Filtro por perfil: un código de rol o uno de estos casos especiales
const SIN_PERFILES = "__sin_perfiles"
const SIN_TRAMITES = "__sin_tramites"
const SIN_AREA = "__sin_area"

// Tiene perfiles que solo el Admin puede tocar (Gastos o Administración)
const tienePerfilesAjenos = (usuario: UsuarioAdmin) =>
  usuario.roles.some(r => !GRUPOS[0].codigos.includes(r.codigo))

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
  const error = errorContrasena(contrasena)
  if (error) return error
  if (contrasena !== confirmacion) return "Las contraseñas no coinciden"
  return null
}

// ── Crear o editar usuario ─────────────────────────────

function ModalUsuario({ usuario, roles, areas, grupos, onCerrar }: { usuario: UsuarioAdmin | null, roles: Rol[], areas: Area[], grupos: typeof GRUPOS, onCerrar: () => void }) {
  const [datos, setDatos] = useState({
    nombreUsuario: usuario?.nombreUsuario ?? "",
    correoUsuario: usuario?.correoUsuario ?? "",
    areaId: usuario?.areaId ?? null as number | null
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
        <select value={datos.areaId ?? ""} onChange={e => setDatos({ ...datos, areaId: e.target.value ? Number(e.target.value) : null })} className={claseInput}>
          <option value="">Sin área</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </label>

      {!usuario && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <CampoContrasena etiqueta="Contraseña" valor={contrasena} onChange={setContrasena} />
              <RequisitosContrasena contrasena={contrasena} />
            </div>
            <CampoContrasena etiqueta="Confirmar contraseña" valor={confirmacion} onChange={setConfirmacion} />
          </div>
          <p className="-mt-2 text-[11px] text-slate-400">Comparta la contraseña con el usuario por un medio seguro (no por correo ni chat).</p>

          <div>
            <p className={claseLabel}>Perfiles</p>
            <div className="space-y-3">
              {grupos.map(grupo => {
                const rolesGrupo = roles.filter(r => grupo.codigos.includes(r.codigo))
                if (!rolesGrupo.length) return null
                return (
                  <fieldset key={grupo.titulo}>
                    <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{grupo.titulo}</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {rolesGrupo.map(rol => {
                        const marcado = perfiles.includes(rol.codigo)
                        return (
                          <label
                            key={rol.codigo}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition ${marcado ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => setPerfiles(p => p.includes(rol.codigo) ? p.filter(c => c !== rol.codigo) : [...p, rol.codigo])}
                              className="h-4 w-4 shrink-0 accent-sky-500"
                            />
                            {rol.nombre}
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
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
      <div>
        <CampoContrasena etiqueta="Nueva contraseña" valor={contrasena} onChange={setContrasena} />
        <RequisitosContrasena contrasena={contrasena} />
      </div>
      <CampoContrasena etiqueta="Confirmar contraseña" valor={confirmacion} onChange={setConfirmacion} />
    </Ventana>
  )
}

// ── Fila de usuario con sus perfiles ───────────────────

function FilaUsuario({ usuario, roles, esUsted, soloTramites, onEditar, onContrasena }: {
  usuario: UsuarioAdmin
  roles: Rol[]
  esUsted: boolean
  soloTramites: boolean
  onEditar: () => void
  onContrasena: () => void
}) {
  const inicial = usuario.roles.map(r => r.codigo)
  const [seleccion, setSeleccion] = useState<string[]>(inicial)
  const { procesando, ejecutar } = useAccion()
  const { procesando: desbloqueando, ejecutar: ejecutarDesbloqueo } = useAccion()

  const huboCambios = seleccion.length !== inicial.length || seleccion.some(c => !inicial.includes(c))
  const sinPerfilTramites = !seleccion.some(c => PERFILES_TRAMITES.includes(c))
  // Los perfiles que no se muestran (Gastos/Administración) van igual en `seleccion` y no cambian
  const bloqueado = soloTramites && tienePerfilesAjenos(usuario)

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="text-xs font-medium text-slate-700">{usuario.nombreUsuario}{esUsted && <span className="ml-1 text-[10px] text-sky-600">(usted)</span>}</p>
        <p className="text-[11px] text-slate-400">{usuario.correoUsuario}{usuario.area && ` · ${usuario.area}`}</p>
        {sinPerfilTramites && <p className="mt-0.5 text-[10px] text-amber-600">Sin acceso a trámites</p>}
        {!!usuario.minutosBloqueo && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-medium text-red-600">
            Bloqueado por intentos fallidos · {usuario.minutosBloqueo} min
            <button
              type="button"
              onClick={() => ejecutarDesbloqueo(() => desbloquearUsuario(usuario.id), `${usuario.nombreUsuario} desbloqueado`)}
              disabled={desbloqueando}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-semibold hover:bg-red-100 disabled:opacity-50"
            >
              {desbloqueando ? <Loader2 size={11} className="animate-spin" /> : <LockOpen size={11} />}
              Desbloquear
            </button>
          </p>
        )}
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
        <button type="button" onClick={onEditar} disabled={bloqueado} className="ml-1 p-1.5 text-slate-400 hover:text-sky-600 disabled:opacity-30 disabled:hover:text-slate-400" aria-label={`Editar ${usuario.nombreUsuario}`} title={bloqueado ? "Tiene perfiles de Gastos o Administración: solo el administrador puede editarlo" : "Editar datos"}>
          <Pencil size={15} />
        </button>
        <button type="button" onClick={onContrasena} disabled={bloqueado} className="p-1.5 text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400" aria-label={`Restablecer contraseña de ${usuario.nombreUsuario}`} title={bloqueado ? "Tiene perfiles de Gastos o Administración: solo el administrador puede cambiar su contraseña" : "Restablecer contraseña"}>
          <KeyRound size={15} />
        </button>
      </td>
    </tr>
  )
}

// ── Pantalla ───────────────────────────────────────────

export default function AdministracionUsuarios({ usuarios, roles, areas, usuarioActualId, soloTramites = false }: {
  usuarios: UsuarioAdmin[]
  roles: Rol[]
  // Catálogo de áreas (Catálogos → Áreas)
  areas: Area[]
  usuarioActualId: number
  // Administrador de Torre de control: solo ve y asigna perfiles de trámites
  soloTramites?: boolean
}) {
  const [busqueda, setBusqueda] = useState("")
  const [perfil, setPerfil] = useState("")
  const [area, setArea] = useState("")
  const [pagina, setPagina] = useState(1)
  // undefined = cerrado | null = nuevo
  const [editando, setEditando] = useState<UsuarioAdmin | null | undefined>(undefined)
  const [contrasena, setContrasena] = useState<UsuarioAdmin | null>(null)

  // Columnas en el orden de los grupos (solo Trámites para el Administrador de Torre de control)
  const grupos = soloTramites ? GRUPOS.slice(0, 1) : GRUPOS
  const rolesOrdenados = grupos.flatMap(g => g.codigos).map(c => roles.find(r => r.codigo === c)).filter(Boolean) as Rol[]

  // El filtro por perfil usa los perfiles guardados (no los marcados sin guardar)
  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return usuarios.filter(u => {
      if (texto && ![u.nombreUsuario, u.correoUsuario, u.area].some(v => v?.toLowerCase().includes(texto))) return false
      if (area === SIN_AREA ? u.areaId !== null : area && u.areaId !== Number(area)) return false
      const codigos = u.roles.map(r => r.codigo)
      if (perfil === SIN_PERFILES) return codigos.length === 0
      if (perfil === SIN_TRAMITES) return !codigos.some(c => PERFILES_TRAMITES.includes(c))
      return !perfil || codigos.includes(perfil)
    })
  }, [usuarios, busqueda, perfil, area])

  const paginas = Math.max(1, Math.ceil(filtrados.length / TAMANO_PAGINA))
  // Si al filtrar quedan menos páginas, se muestra la última que existe
  const paginaActual = Math.min(pagina, paginas)
  const visibles = filtrados.slice((paginaActual - 1) * TAMANO_PAGINA, paginaActual * TAMANO_PAGINA)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full max-w-3xl flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} placeholder="Buscar por nombre, correo o área" className={`${claseInput} pl-9`} aria-label="Buscar usuario" />
          </div>
          <select value={perfil} onChange={e => { setPerfil(e.target.value); setPagina(1) }} className={`${claseInput} w-full sm:w-56`} aria-label="Filtrar por perfil">
            <option value="">Todos los perfiles</option>
            {grupos.map(g => (
              <optgroup key={g.titulo} label={g.titulo}>
                {rolesOrdenados.filter(r => g.codigos.includes(r.codigo)).map(r => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
              </optgroup>
            ))}
            <optgroup label="Revisión">
              <option value={SIN_TRAMITES}>Sin acceso a trámites</option>
              <option value={SIN_PERFILES}>Sin ningún perfil</option>
            </optgroup>
          </select>
          <select value={area} onChange={e => { setArea(e.target.value); setPagina(1) }} className={`${claseInput} w-full sm:w-48`} aria-label="Filtrar por área">
            <option value="">Todas las áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            <option value={SIN_AREA}>Sin área</option>
          </select>
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
              {grupos.map(g => (
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
            {visibles.map(u => (
              <FilaUsuario
                key={`${u.id}-${u.roles.map(r => r.codigo).join(",")}`}
                usuario={u}
                roles={rolesOrdenados}
                esUsted={u.id === usuarioActualId}
                soloTramites={soloTramites}
                onEditar={() => setEditando(u)}
                onContrasena={() => setContrasena(u)}
              />
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No hay usuarios que coincidan.</p>}
      </div>

      {/* PAGINACIÓN */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {filtrados.length === usuarios.length
            ? `${usuarios.length.toLocaleString("es-CO")} usuario(s)`
            : `${filtrados.length.toLocaleString("es-CO")} de ${usuarios.length.toLocaleString("es-CO")} usuario(s)`}
        </span>
        {paginas > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 1} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30" aria-label="Página anterior">
              <ChevronLeft size={15} />
            </button>
            <span>Página {paginaActual} de {paginas}</span>
            <button type="button" onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual === paginas} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30" aria-label="Página siguiente">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {editando !== undefined && (
        <ModalUsuario key={editando?.id ?? "nuevo"} usuario={editando} roles={rolesOrdenados} areas={areas} grupos={grupos} onCerrar={() => setEditando(undefined)} />
      )}
      {contrasena && <ModalContrasena usuario={contrasena} onCerrar={() => setContrasena(null)} />}
    </div>
  )
}
