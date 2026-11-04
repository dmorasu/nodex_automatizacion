// Rótulos de envío (Ayudas Torre de Control, fase 3). Tipos de /api/rotulos y las reglas que la
// pantalla necesita para mostrar el formulario. Las mismas reglas están en el backend
// (services/rotulos/reglasRotulo.ts), que es el que decide: aquí solo se muestran.

export type Origen = "gpa" | "tram"
export type Destino = "cliente" | "tram" | "gpa" | "tercero"

export type SedeRotulo = { id: number, nombre: string, ciudad: string | null, direccion: string | null, celular: string | null, horario: string | null }
export type TramitadorRotulo = {
  id: number, nombre: string, cedula: string | null, celular: string | null, direccion: string | null,
  municipio: string | null, departamento: string | null, correo: string | null, esMensajero: boolean
}
export type MunicipioRotulo = { id: number, nombre: string, departamento: string }
export type OpcionesRotulo = {
  gpa: { razon: string, nit: string, correo: string, obsHorario: string }
  // Todos los municipios (una copia por nombre y departamento), para elegir sin esperar al servidor
  municipios: MunicipioRotulo[]
  sedes: SedeRotulo[]
  operaciones: { id: number, nombre: string, centroDeCostos: string | null }[]
  transportadoras: string[]
  tramitadores: TramitadorRotulo[]
  tipos: string[]
  contenidos: string[]
  solicitantes: string[]
}
export type TramiteParaRotulo = {
  id: number
  placa: string
  nombreTramite: string | null
  operacionId: number | null
  tramitadorId: number | null
  solicitante: string
  cliente: { nombre: string, identificacion: string, telefono: string } | null
  municipio: { id: number, nombre: string, departamento: string } | null
  direccion: string
}
export type VistaPrevia = { faltan: string[], tamano: "carta" | "peq", paga: "GPA" | "DESTINATARIO", contraentrega: boolean, pdf: string }
export type RotuloCreado = { id: number, nombre: string, tramites: number[], logisticas: number[], transportadoraEnCatalogo: boolean }
export type RotuloListado = {
  id: number, creado: string, usuario: string | null, flujo: string, destinatario: string, ciudad: string, contraentrega: boolean,
  paga: string, transportadora: string | null, tamano: string, contenido: string, tramites: number[]
}

export const ORIGENES: { v: Origen, nombre: string }[] = [{ v: "gpa", nombre: "Oficina GPA" }, { v: "tram", nombre: "Tramitador" }]
export const DESTINOS: { v: Destino, nombre: string }[] = [
  { v: "cliente", nombre: "Cliente" }, { v: "tram", nombre: "Tramitador" }, { v: "gpa", nombre: "Oficina GPA" }, { v: "tercero", nombre: "Tercero (notaría, entidad)" }
]

// Un tramitador no le envía a otro tramitador ni a un tercero
export const flujoPermitido = (origen: Origen, destino: Destino) => !(origen === "tram" && (destino === "tram" || destino === "tercero"))

export const normalizar = (texto: string | null | undefined) =>
  String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim()

export const formatoTelefono = (valor: string | null | undefined) => {
  const digitos = String(valor ?? "").replace(/\D/g, "")
  const local = digitos.length === 12 && digitos.startsWith("57") ? digitos.slice(2) : digitos
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : String(valor ?? "").trim()
}

export const esCorreoGpa = (correo: string | null | undefined) => /@gomezpinedaabogados\.com$/i.test(String(correo ?? "").trim())

// Quién paga: igual que reglaPago() del backend. `fijo` = el flujo no deja elegir contraentrega
export const reglaPago = (origen: Origen, destino: Destino, linea: string, contraentrega: boolean) => {
  const flujo = `${origen}-${destino}`
  if (normalizar(linea).includes("POSTOBON")) return { contraentrega: false, pagaDestinatario: false, fijo: "Postobón: siempre lo asume Gómez Pineda Abogados." }
  if (flujo === "gpa-gpa") return { contraentrega: false, pagaDestinatario: false, fijo: "Entre oficinas lo asume la oficina GPA que envía." }
  if (flujo === "gpa-tercero") return { contraentrega: false, pagaDestinatario: false, fijo: "Envíos a terceros los asume Gómez Pineda Abogados." }
  if (flujo === "tram-gpa") return { contraentrega: true, pagaDestinatario: false, fijo: "Lo asume Gómez Pineda Abogados al recibirlo en la oficina." }
  return { contraentrega, pagaDestinatario: contraentrega, fijo: "" }
}

// Observaciones de siempre (las mismas del backend): tramitador → cliente devuelve a Medellín
export const observacionesAutomaticas = (origen: Origen, destino: Destino, opciones: OpcionesRotulo) => {
  const { gpa, sedes } = opciones
  if (origen === "tram" && destino === "cliente") {
    const s = sedes.find(x => normalizar(x.nombre).includes("MEDELLIN") || normalizar(x.ciudad).includes("MEDELLIN")) ?? sedes[0]
    const tel = s?.celular ? ` · Tel. ${formatoTelefono(s.celular)}` : ""
    const dir = String(s?.direccion ?? "").replace(/\s+/g, " ").trim()
    return `Devolver a ${gpa.razon} - ${s?.nombre ?? "GPA Medellín"}: ${dir}, ${s?.ciudad ?? "Medellín"}${tel}. NO devolver al tramitador remitente. El costo del retorno lo asume Gómez Pineda Abogados: se paga contraentrega al recibirlo en la oficina de Medellín y la factura de la devolución debe expedirse a nombre de ${gpa.razon}, NIT ${gpa.nit}, correo ${gpa.correo}. Recepción: lunes de 7:00 a.m. a 5:00 p.m., martes a jueves de 7:30 a.m. a 5:00 p.m. y viernes de 7:30 a.m. a 4:00 p.m. No se reciben paquetes los sábados ni domingos.`
  }
  return gpa.obsHorario
}

// Tamaño que el backend elige solo: pequeño para el sobre de la tarjeta de propiedad
export const tamanoAutomatico = (tipo: string, contenido: string) =>
  /SOBRE PEQUENO/.test(normalizar(tipo)) || /TARJETA DE PROPIEDAD/.test(normalizar(contenido)) ? "peq" : "carta"
