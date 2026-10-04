// =====================================
// ACCIONES DE LA GESTIÓN MASIVA EN PANTALLA
// Cada acción tiene las mismas columnas que su plantilla de Excel: el backend usa la
// misma validación y el mismo proceso (/api/bulk/<tipo>/validar|procesar con { filas }).
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
    descripcion: "Registra el nuevo estado de cada trámite. Si escribe una observación, se guarda primero como trazabilidad.",
    aviso: "Notifica igual que el cambio individual: Desistido avisa al tramitador por WhatsApp; En espera por novedad y Finalizado envían correo al solicitante.",
    campos: [
      { clave: "estadoId", etiqueta: "Nuevo estado", tipo: "seleccion", catalogo: "estados", obligatorio: true },
      { clave: "tipoRechazoId", etiqueta: "Tipo de rechazo", tipo: "seleccion", catalogo: "tiposRechazo" },
      { clave: "observacion", etiqueta: "Observación (trazabilidad)", tipo: "textoLargo", auxiliar: true }
    ]
  },
  {
    tipo: "trazabilidad",
    nombre: "Agregar trazabilidad",
    descripcion: "Agrega una observación a la trazabilidad de cada trámite. Queda registrada a su nombre.",
    campos: [
      { clave: "observacionTrazabilidad", etiqueta: "Observación", tipo: "textoLargo", obligatorio: true }
    ]
  },
  {
    tipo: "programacion",
    nombre: "Programación",
    descripcion: "Fecha probable de entrega, valores y conceptos. La tabla arranca con lo que ya tiene cada trámite: un campo vacío borra el dato.",
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
    descripcion: "Guía, destinatario, valor y fechas del envío. La tabla arranca con lo que ya tiene cada trámite: un campo vacío borra el dato.",
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
    descripcion: "Asigna el tramitador de cada trámite.",
    aviso: "Envía por WhatsApp la diligencia asignada a cada tramitador.",
    campos: [
      { clave: "tramitadorId", etiqueta: "Tramitador", tipo: "seleccion", catalogo: "tramitadores", obligatorio: true }
    ]
  }
]

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
