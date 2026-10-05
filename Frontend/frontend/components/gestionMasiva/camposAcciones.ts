// =====================================
// ACCIONES DE LA GESTIÓN MASIVA EN PANTALLA
// Cada acción tiene las mismas columnas que su plantilla de Excel: el backend usa la
// misma validación y el mismo proceso (/api/bulk/<tipo>/validar|procesar con { filas }).
// Se pueden combinar varias acciones en un mismo guardado; cada fila solo entra en las
// acciones donde tiene algo que aplicar (ver `tieneCambios`).
// =====================================

export type TipoAccion = "estados" | "trazabilidad" | "programacion" | "logistica" | "tramitador"

export type Catalogo = "estados" | "tiposRechazo" | "tramitadores" | "transportadoras"

export type Campo = {
  clave: string
  etiqueta: string
  tipo: "texto" | "textoLargo" | "numero" | "fecha" | "seleccion"
  catalogo?: Catalogo
  obligatorio?: boolean
  // No va al backend en la fila de esta acción (se usa aparte; ej: observación del cambio de estado)
  auxiliar?: boolean
}

export type Accion = {
  tipo: TipoAccion
  nombre: string
  descripcion: string
  aviso?: string
  campos: Campo[]
}

export const ACCIONES: Accion[] = [
  {
    tipo: "estados",
    nombre: "Cambiar estado",
    descripcion: "Registra el nuevo estado. Deje el estado vacío en los trámites que no deben cambiar. Si escribe una observación, se guarda primero como trazabilidad.",
    aviso: "Notifica igual que el cambio individual: Desistido avisa al tramitador por WhatsApp; En espera por novedad y Finalizado envían correo al solicitante.",
    campos: [
      { clave: "estadoId", etiqueta: "Nuevo estado", tipo: "seleccion", catalogo: "estados" },
      { clave: "tipoRechazoId", etiqueta: "Tipo de rechazo", tipo: "seleccion", catalogo: "tiposRechazo" },
      { clave: "observacion", etiqueta: "Observación (trazabilidad)", tipo: "textoLargo", auxiliar: true }
    ]
  },
  {
    tipo: "trazabilidad",
    nombre: "Agregar trazabilidad",
    descripcion: "Agrega una observación a la trazabilidad (queda a su nombre). Los trámites sin observación no se tocan.",
    campos: [
      { clave: "observacionTrazabilidad", etiqueta: "Observación", tipo: "textoLargo" }
    ]
  },
  {
    tipo: "programacion",
    nombre: "Programación",
    descripcion: "Fecha probable de entrega, valores y conceptos. Arranca con lo que ya tiene cada trámite (un campo vacío borra el dato); solo se guardan los trámites que cambien.",
    aviso: "Envía el correo de programación al solicitante de cada trámite.",
    campos: [
      { clave: "fechaProbableEntrega", etiqueta: "Fecha probable de entrega", tipo: "fecha" },
      { clave: "valorTramite", etiqueta: "Valor trámite", tipo: "numero" },
      { clave: "valorViaticos", etiqueta: "Valor viáticos", tipo: "numero" },
      { clave: "conceptoHonorarios", etiqueta: "Concepto honorarios", tipo: "texto" },
      { clave: "conceptoViaticos", etiqueta: "Concepto viáticos", tipo: "texto" }
    ]
  },
  {
    tipo: "logistica",
    nombre: "Logística",
    descripcion: "Guía, destinatario, valor y fechas del envío. Arranca con lo que ya tiene cada trámite (un campo vacío borra el dato); solo se guardan los trámites que cambien.",
    campos: [
      { clave: "numeroGuia", etiqueta: "Número de guía", tipo: "texto" },
      { clave: "destinatario", etiqueta: "Destinatario", tipo: "texto" },
      { clave: "valorEnvio", etiqueta: "Valor envío", tipo: "numero" },
      { clave: "fechaProgramacionLogistica", etiqueta: "Fecha programación", tipo: "fecha" },
      { clave: "fechaEntregaTransportadora", etiqueta: "Fecha entrega a transportadora", tipo: "fecha" },
      { clave: "transportadoraId", etiqueta: "Transportadora", tipo: "seleccion", catalogo: "transportadoras" }
    ]
  },
  {
    tipo: "tramitador",
    nombre: "Asignar tramitador",
    descripcion: "Asigna el tramitador. Solo se guardan los trámites donde el tramitador cambie.",
    aviso: "Envía por WhatsApp la diligencia asignada a cada tramitador.",
    campos: [
      { clave: "tramitadorId", etiqueta: "Tramitador", tipo: "seleccion", catalogo: "tramitadores" }
    ]
  }
]

// Orden al guardar varias acciones juntas: primero lo que alimenta las notificaciones
// (tramitador, programación, logística, observación) y al final el estado, para que el aviso
// de Novedad/Finalizado salga con los datos y la trazabilidad ya guardados.
export const ORDEN_GUARDADO: TipoAccion[] = ["tramitador", "programacion", "logistica", "trazabilidad", "estados"]

// Campos visibles de una acción. Si también se eligió "Agregar trazabilidad", el cambio de
// estado no muestra su propia observación (se usa la de trazabilidad, que se guarda antes).
export const camposVisibles = (accion: Accion, tipos: TipoAccion[]) =>
  accion.tipo === "estados" && tipos.includes("trazabilidad")
    ? accion.campos.filter(c => c.clave !== "observacion")
    : accion.campos

// Trámite con sus valores actuales (GET /api/bulk/tramites?ids=)
export type TramiteMasivo = {
  id: number
  placa: string | null
  matriculaInmobiliaria: string | null
  tramitadorId: number | null
  nombreAnalista: string | null
  clientes: { nombreCliente: string, identificacionCliente: string } | null
  tramite: { nombreTramite: string } | null
  municipios: { nombreMunicipio: string } | null
  tramitador: { nombreTramitador: string } | null
  estadoActual: { id: number, nombreEstado: string } | null
  programacion: Record<string, string | number | null> | null
  logistica: Record<string, string | number | null> | null
}

// "2026-09-10T00:00:00.000Z" → "2026-09-10"
const aFecha = (valor: unknown) => (valor ? String(valor).slice(0, 10) : "")
const aTexto = (valor: unknown) => (valor === null || valor === undefined ? "" : String(valor))

// Valores iniciales de la fila: lo que ya tiene el trámite (para no borrar datos al guardar)
export const valoresActuales = (tipo: TipoAccion, tramite: TramiteMasivo): Record<string, string> => {
  const accion = ACCIONES.find(a => a.tipo === tipo)!
  const origen =
    tipo === "programacion" ? tramite.programacion
      : tipo === "logistica" ? tramite.logistica
        : tipo === "tramitador" ? { tramitadorId: tramite.tramitadorId }
          : null

  return Object.fromEntries(accion.campos.map(campo => [
    campo.clave,
    campo.tipo === "fecha" ? aFecha(origen?.[campo.clave]) : aTexto(origen?.[campo.clave])
  ]))
}

// Valores iniciales de todas las acciones juntas (las claves no se repiten entre acciones)
export const valoresIniciales = (tramite: TramiteMasivo) =>
  Object.assign({}, ...ACCIONES.map(a => valoresActuales(a.tipo, tramite))) as Record<string, string>

// ¿Esta fila tiene algo que aplicar en esta acción? Así una fila puede quedar por fuera de
// una acción (estado vacío, sin observación o sin cambios) y entrar en las demás.
export const tieneCambios = (tipo: TipoAccion, fila: Record<string, string> | undefined, tramite: TramiteMasivo) => {
  const v = fila ?? {}
  if (tipo === "estados") return Boolean(v.estadoId)
  if (tipo === "trazabilidad") return Boolean(v.observacionTrazabilidad?.trim())
  if (tipo === "tramitador") return Boolean(v.tramitadorId) && v.tramitadorId !== String(tramite.tramitadorId ?? "")
  // Programación y logística: algún campo distinto de lo que ya tiene (evita reenviar correos)
  const actual = valoresActuales(tipo, tramite)
  return Object.keys(actual).some(clave => (v[clave] ?? "") !== actual[clave])
}
