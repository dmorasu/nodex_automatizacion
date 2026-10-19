"use client"

import {
  Children,
  Fragment,
  isValidElement,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react"
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react"
import { Check, ChevronsUpDown } from "lucide-react"

// =====================================
// LISTA DESPLEGABLE CON BÚSQUEDA
// Se usa igual que un <select> (mismas <option> y <optgroup>, value / defaultValue, name,
// onChange con e.target.value). Con pocas opciones se queda como el <select> de siempre; con
// muchas se puede escribir para filtrar: sin tildes ni mayúsculas, por palabras en cualquier
// orden ("med ant" encuentra "Medellín - Antioquia") y primero lo que empieza por lo escrito.
// =====================================

// Desde cuántas opciones se puede escribir para buscar
const MINIMO_PARA_BUSCAR = 8

type Opcion = { valor: string, texto: string, grupo?: string, deshabilitada?: boolean }

type Props = {
  children: ReactNode
  value?: string | number | null
  defaultValue?: string | number | null
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  name?: string
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  "aria-label"?: string
  // La lista ya dibuja su propio ícono y su flecha (ej: OperacionesSelect): sin la de aquí
  sinFlecha?: boolean
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

// Texto de una <option>: puede venir partido ({nombre} · {linea})
const textoDe = (nodo: ReactNode): string =>
  Children.toArray(nodo).map(hijo =>
    typeof hijo === "string" || typeof hijo === "number" ? String(hijo)
      : isValidElement<{ children?: ReactNode }>(hijo) ? textoDe(hijo.props.children)
        : ""
  ).join("")

// <option> y <optgroup> (también dentro de fragmentos o listas) → opciones
const leerOpciones = (nodo: ReactNode, grupo?: string): Opcion[] =>
  Children.toArray(nodo).flatMap(hijo => {
    if (!isValidElement<{ children?: ReactNode, value?: unknown, label?: string, disabled?: boolean }>(hijo)) return []
    if (hijo.type === Fragment) return leerOpciones(hijo.props.children, grupo)
    if (hijo.type === "optgroup") return leerOpciones(hijo.props.children, hijo.props.label)
    if (hijo.type !== "option") return []
    const texto = textoDe(hijo.props.children).replace(/\s+/g, " ").trim()
    return [{ valor: String(hijo.props.value ?? texto), texto, grupo, deshabilitada: hijo.props.disabled }]
  })

// Todas las palabras deben aparecer; primero lo que empieza por lo escrito, luego lo que tiene
// una palabra que empieza así, y al final el resto (en el orden original)
const filtrar = (opciones: Opcion[], busqueda: string) => {
  const consulta = normalizar(busqueda)
  if (!consulta) return opciones
  const palabras = consulta.split(/\s+/)
  return opciones
    .map((opcion, orden) => ({ opcion, orden, texto: normalizar(opcion.texto) }))
    .filter(({ texto }) => palabras.every(p => texto.includes(p)))
    .map(f => ({ ...f, puntaje: f.texto.startsWith(consulta) ? 0 : f.texto.split(/[\s\-·,/()]+/).some(t => t.startsWith(palabras[0])) ? 1 : 2 }))
    .sort((a, b) => a.puntaje - b.puntaje || a.orden - b.orden)
    .map(f => f.opcion)
}

export default function SelectBuscable({ children, value, defaultValue, onChange, name, id, className, disabled, required, "aria-label": ariaLabel, sinFlecha }: Props) {
  const opciones = useMemo(() => leerOpciones(children), [children])
  const controlado = value !== undefined
  const [interno, setInterno] = useState(String(defaultValue ?? ""))
  const [busqueda, setBusqueda] = useState("")
  const oculto = useRef<HTMLInputElement>(null)

  const actual = controlado ? String(value ?? "") : interno
  const seleccionada = opciones.find(o => o.valor === actual) ?? null
  // La opción vacía ("Todas", "Seleccione"...) sirve de texto guía y para dejar el campo sin valor
  const vacia = opciones.find(o => o.valor === "")

  // Pocas opciones: el <select> de siempre
  if (opciones.filter(o => o.valor !== "").length < MINIMO_PARA_BUSCAR) {
    return (
      <select
        name={name}
        id={id}
        className={className}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        {...(controlado ? { value: actual, onChange } : { defaultValue: actual, onChange })}
      >
        {children}
      </select>
    )
  }

  const elegir = (opcion: Opcion | null) => {
    const valor = opcion?.valor ?? ""
    if (!controlado) setInterno(valor)
    setBusqueda("")
    // Mismo evento que un <select>: quien lo usa lee e.target.value
    if (oculto.current && onChange) {
      oculto.current.value = valor
      onChange({ target: oculto.current, currentTarget: oculto.current } as unknown as ChangeEvent<HTMLSelectElement>)
    }
  }

  const visibles = filtrar(opciones, busqueda)

  const campo = (
    <ComboboxInput
      id={id}
      aria-label={ariaLabel}
      required={required}
      autoComplete="off"
      className={sinFlecha ? className : `${className ?? ""} pr-8`}
      displayValue={(opcion: Opcion | null) => (opcion && opcion.valor !== "" ? opcion.texto : "")}
      placeholder={vacia?.texto ?? "Escriba para buscar"}
      onChange={e => setBusqueda(e.target.value)}
      // Al entrar se selecciona el texto: lo que se escriba reemplaza la opción actual
      onFocus={e => e.target.select()}
      onBlur={() => setBusqueda("")}
    />
  )

  return (
    <Combobox value={seleccionada} onChange={elegir} disabled={disabled} immediate by={(a, b) => a?.valor === b?.valor}>
      {sinFlecha ? campo : (
        <div className="relative w-full">
          {campo}
          <ChevronsUpDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      )}

      <ComboboxOptions
        anchor="bottom start"
        className="z-[70] max-h-64 w-[var(--input-width)] min-w-[12rem] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg [--anchor-gap:4px] empty:invisible"
      >
        {visibles.length === 0 && <p className="px-3 py-2 text-slate-400">Sin resultados para &quot;{busqueda}&quot;</p>}
        {visibles.map((opcion, i) => (
          <Fragment key={`${opcion.grupo ?? ""}-${opcion.valor}`}>
            {opcion.grupo && opcion.grupo !== visibles[i - 1]?.grupo && (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{opcion.grupo}</p>
            )}
            <ComboboxOption
              value={opcion}
              disabled={opcion.deshabilitada}
              className="group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-slate-700 data-[disabled]:cursor-not-allowed data-[focus]:bg-sky-50 data-[focus]:text-sky-800 data-[disabled]:opacity-40"
            >
              <span className={`flex-1 ${opcion.valor === "" ? "text-slate-400" : ""}`}>{opcion.texto}</span>
              <Check size={13} className="invisible shrink-0 text-sky-600 group-data-[selected]:visible" />
            </ComboboxOption>
          </Fragment>
        ))}
      </ComboboxOptions>

      <input ref={oculto} type="hidden" name={name} value={actual} readOnly />
    </Combobox>
  )
}
