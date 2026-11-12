import type { Transaction } from 'sequelize'
import { db } from '../config/db'
import PlacaTramite from '../models/placaTramite'
import { ErrorGastos } from './gastos/errores'

// =====================================
// PLACAS DEL TRÁMITE (2026-11-12)
// Un trámite puede llevar hasta 10 placas. En SolicitudTramites.placa queda el texto legible
// ("ABC123, DEF456") y cada placa, normalizada, en solicitud_tramite_placas: así la búsqueda por
// placa encuentra el trámite con cualquiera de ellas usando un índice, en lugar de recorrer el
// texto de todos los trámites.
// =====================================

export const MAXIMO_PLACAS = 10

// Largo de una placa normalizada: las de carro y moto tienen 5 o 6; se deja margen para las de
// remolque, diplomáticas o números que se escriben en el campo de placa
const LARGO_MINIMO = 4
const LARGO_MAXIMO = 20

const quitarTildes = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')

// "abc-123, DEF 456 y ghi789" → ["ABC123", "DEF456", "GHI789"].
// Antes de separar se juntan las placas escritas con espacio o guion en medio: letras (1 a 3) y
// números (2 a 5, con letra final opcional): "ABC-123", "ABC 12D", la moto vieja "ABC-12" y el
// remolque "R-12345".
// Lo que no parece placa (la "Y" de "ABC123 y DEF456") se descarta. Sin repetidas, en el orden escrito.
// La misma regla está en SQL en el ajuste de esquema (ajustesEsquemaTramites.ts, placasDeLosTramites).
export const separarPlacas = (texto: unknown): string[] => {
  const unido = quitarTildes(String(texto ?? '').toUpperCase())
    .replace(/\b([A-Z]{1,3})[\s-]+(\d{2,5}[A-Z]?)\b/g, '$1$2')
  const placas = unido.split(/[^A-Z0-9]+/).filter(p => p.length >= LARGO_MINIMO && p.length <= LARGO_MAXIMO)
  return [...new Set(placas)]
}

// Texto que se guarda en SolicitudTramites.placa (null si no hay ninguna)
export const textoDePlacas = (placas: string[]) => (placas.length ? placas.join(', ') : null)

// Para los trámites nuevos (formulario y cargue masivo): máximo 10 y cada una con forma de placa.
// Devuelve el texto normalizado para guardar. Los trámites viejos con más placas no se tocan.
export const placasParaGuardar = (texto: unknown): string | null => {
  const escrito = String(texto ?? '').trim()
  if (!escrito) return null
  const placas = separarPlacas(escrito)
  if (!placas.length) throw new ErrorGastos(`"${escrito}" no es una placa válida`)
  if (placas.length > MAXIMO_PLACAS) throw new ErrorGastos(`Máximo ${MAXIMO_PLACAS} placas por trámite (hay ${placas.length})`)
  return textoDePlacas(placas)
}

// Deja en solicitud_tramite_placas las placas del texto del trámite (lo llama el hook del modelo
// cada vez que se crea el trámite o cambia su placa, en la misma transacción)
export const sincronizarPlacas = async (solicitudTramiteId: number, placa: unknown, transaction?: Transaction | null) => {
  const placas = separarPlacas(placa)
  await PlacaTramite.destroy({ where: { solicitudTramiteId }, transaction: transaction ?? undefined })
  if (!placas.length) return
  await PlacaTramite.bulkCreate(
    placas.map((p, i) => ({ solicitudTramiteId, placa: p, orden: i + 1 })),
    { transaction: transaction ?? undefined }
  )
}

// Subconsulta con los ids de los trámites que tienen la placa buscada (para `id IN (...)`).
// Con 6 o más caracteres (una placa completa) se busca la placa exacta o que empiece así: usa el
// índice. Con menos se busca en cualquier parte ("123" encuentra ABC123), como antes; la tabla es
// angosta (id y placa), así que sigue siendo rápida. null si el texto no tiene letras ni números.
export const subconsultaPlaca = (texto: unknown): string | null => {
  const buscado = quitarTildes(String(texto ?? '').toUpperCase()).replace(/[^A-Z0-9]/g, '')
  if (!buscado) return null
  const patron = buscado.length >= 6 ? `${buscado}%` : `%${buscado}%`
  return `(SELECT pt.solicitud_tramite_id FROM solicitud_tramite_placas pt WHERE pt.placa LIKE ${db.escape(patron)})`
}
