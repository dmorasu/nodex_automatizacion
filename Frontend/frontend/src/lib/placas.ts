// Varias placas por trámite (2026-11-12). Misma regla del backend (services/placasTramite.ts):
// mayúsculas, sin signos; "ABC 123", "ABC-123", "ABC-12" o "R-12345" es una sola placa; lo muy corto (la "Y" de
// "ABC123 y DEF456") no cuenta.
export const MAXIMO_PLACAS = 10

export const separarPlacas = (texto: string): string[] => {
  const unido = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/\b([A-Z]{1,3})[\s-]+(\d{2,5}[A-Z]?)\b/g, "$1$2")
  const placas = unido.split(/[^A-Z0-9]+/).filter(p => p.length >= 4 && p.length <= 20)
  return [...new Set(placas)]
}

// Lo que se guarda en el trámite: "ABC123, DEF456"
export const textoDePlacas = (placas: string[]) => placas.join(", ")
