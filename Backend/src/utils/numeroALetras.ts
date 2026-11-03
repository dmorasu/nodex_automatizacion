// Valor en letras para las cuentas de cobro: 350000 → "Trescientos cincuenta mil pesos".
// Solo pesos enteros (las cuentas de cobro no llevan centavos).

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

// 0 a 999
const centenas = (n: number): string => {
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const d = resto < 30 ? UNIDADES[resto] : DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` y ${UNIDADES[resto % 10]}` : '')
  return [CENTENAS[c], d].filter(Boolean).join(' ')
}

// "uno" se apocopa delante de mil y millones: "veintiún mil", "un millón"
const apocope = (texto: string) => texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

const enteroALetras = (n: number): string => {
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones) partes.push(millones === 1 ? 'un millón' : `${apocope(enteroALetras(millones))} millones`)
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocope(centenas(miles))} mil`)
  if (resto) partes.push(centenas(resto))
  return partes.join(' ')
}

export const pesosEnLetras = (pesos: number) => {
  const entero = Math.round(Math.abs(pesos))
  let texto = enteroALetras(entero)
  // "un millón de pesos", "dos millones de pesos" (sin miles ni unidades después)
  texto += /(millón|millones)$/.test(texto) ? ' de pesos' : ' pesos'
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
