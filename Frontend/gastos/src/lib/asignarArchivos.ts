// Propone a qué gasto corresponde un archivo según su nombre.
// Ej: "Factura GAS-2026-000012.pdf", "3758 escrituras.pdf", "ABC123 impuesto.jpg"

export type GastoCandidato = {
  id: number
  codigo: string
  solicitudTramiteId?: number | null
  placa?: string | null
  matriculaInmobiliaria?: string | null
}

// Mayúsculas, sin tildes y sin separadores, para comparar placas y matrículas
const compacto = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "")

// Números sueltos del nombre (para el N° de trámite): "tramite_3758-2.pdf" → [3758, 2]
const numerosSueltos = (texto: string) => (texto.match(/\d+/g) ?? []).map(Number)

// Qué tan seguro es que el archivo sea de ese gasto (0 = nada que ver)
const puntaje = (nombreArchivo: string, gasto: GastoCandidato) => {
  const nombre = compacto(nombreArchivo.replace(/\.[^.]+$/, ""))
  let mejor = 0

  if (nombre.includes(compacto(gasto.codigo))) mejor = Math.max(mejor, 100)
  if (gasto.solicitudTramiteId && numerosSueltos(nombreArchivo).includes(gasto.solicitudTramiteId)) mejor = Math.max(mejor, 80)

  const placa = gasto.placa ? compacto(gasto.placa) : ""
  if (placa.length >= 5 && nombre.includes(placa)) mejor = Math.max(mejor, 70)

  const matricula = gasto.matriculaInmobiliaria ? compacto(gasto.matriculaInmobiliaria) : ""
  if (matricula.length >= 5 && nombre.includes(matricula)) mejor = Math.max(mejor, 60)

  return mejor
}

// Gasto propuesto, o null si no se reconoce o si dos gastos empatan (mejor que lo elija la persona)
export const proponerGasto = (nombreArchivo: string, gastos: GastoCandidato[]) => {
  const puntajes = gastos
    .map(gasto => ({ gasto, valor: puntaje(nombreArchivo, gasto) }))
    .filter(p => p.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  if (puntajes.length === 0) return null
  if (puntajes.length > 1 && puntajes[0].valor === puntajes[1].valor) return null
  return puntajes[0].gasto.id
}
