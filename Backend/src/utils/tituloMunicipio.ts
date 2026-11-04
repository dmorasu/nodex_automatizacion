// "SAN JOSÉ DE CÚCUTA" → "San José de Cúcuta" (los municipios vienen en mayúsculas)
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'en'])

// Las siglas quedan en mayúsculas: "BOGOTÁ, D.C." → "Bogotá, D.C."
export const tituloMunicipio = (texto: string | null | undefined) =>
  String(texto ?? '').toLowerCase().split(/(\s+)/)
    .map((p, i) => (/^([a-zñ]\.)+,?$/.test(p) ? p.toUpperCase() : i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('').trim()
