import XLSX from 'xlsx'
import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import { hoja } from '../exportarCatalogos'
import { numeroCuentaTramitador, type EstadoCuentaTramitador } from '../../models/cuentasCobroTramitador/cuentaCobroTramitador'
import type { TipoLineaCuenta } from '../../models/cuentasCobroTramitador/lineaCuentaCobroTramitador'

// =====================================
// EXCEL DE LAS CUENTAS DE COBRO (Nodex Trámites → Cuentas de cobro → Descargar Excel)
// Hoja "Cuentas" (una fila por cuenta con sus totales) y hoja "Detalle" (una fila por línea),
// con los mismos filtros de la pestaña pero sin paginar. Los valores van en pesos como número
// para que se puedan sumar y filtrar en Excel.
// =====================================

const NOMBRE_ESTADO: Record<EstadoCuentaTramitador, string> = {
  BORRADOR: 'Borrador',
  CON_TRAMITADOR: 'Con el tramitador',
  POR_CORREGIR: 'Por corregir',
  APROBADA: 'Aprobada por el tramitador',
  EN_TESORERIA: 'En Tesorería',
  PAGADA: 'Pagada',
  ANULADA: 'Anulada'
}

const NOMBRE_TIPO: Record<TipoLineaCuenta, string> = {
  TRAMITE: 'Trámite',
  VISITA_FALLIDA: 'Visita fallida',
  ADICIONAL: 'Adicional'
}

const aPesos = (centavos: unknown) => Math.round(Number(centavos ?? 0)) / 100

// Formato de pesos en las columnas de valor (el número sigue siendo número)
const conFormatoPesos = (ws: XLSX.WorkSheet, columnas: string[]) => {
  const rango = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = rango.s.c; c <= rango.e.c; c++) {
    const encabezado = ws[XLSX.utils.encode_cell({ r: 0, c })]?.v
    if (!columnas.includes(String(encabezado))) continue
    for (let r = 1; r <= rango.e.r; r++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c })]
      if (celda?.t === 'n') celda.z = '"$"#,##0'
    }
  }
  return ws
}

// Mismo filtro de la búsqueda del listado: número (CCT-0001 o 1), nombre o identificación
const filtroCuentas = (estados: string[], q?: string) => {
  const condiciones: string[] = []
  const valores: Record<string, unknown> = {}
  if (estados.length) {
    condiciones.push('c.estado IN (:estados)')
    valores.estados = estados
  }
  const texto = q?.trim()
  if (texto) {
    const numero = Number(texto.replace(/^cct-?/i, ''))
    valores.texto = `%${texto}%`
    valores.numero = Number.isInteger(numero) && numero > 0 ? numero : -1
    condiciones.push(`(c.consecutivo = :numero OR t."nombreTramitador" ILIKE :texto OR t.identificacion ILIKE :texto)`)
  }
  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', valores }
}

const fechaBogota = (columna: string) => `to_char(${columna} AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI')`

export const generarExcelCuentasCobro = async (estados: string[], q?: string) => {
  const { where, valores } = filtroCuentas(estados, q)

  const cuentas = await db.query<Record<string, any>>(`
    SELECT c.id, c.consecutivo, c.estado, to_char(c.semana, 'YYYY-MM-DD') AS semana,
      to_char(c.semana - 6, 'YYYY-MM-DD') AS "semanaDesde", c.total,
      t."nombreTramitador", t.identificacion,
      -- Los datos con que se envió la cuenta; si aún no se envía, los de hoy del tramitador
      COALESCE(c.datos_tramitador->>'ciudad', t.ciudad) AS ciudad,
      COALESCE(c.datos_tramitador->>'banco', t.banco) AS banco,
      COALESCE(c.datos_tramitador->>'tipoCuenta', t."tipoCuenta") AS "tipoCuenta",
      COALESCE(c.datos_tramitador->>'numeroCuenta', t."numeroCuenta") AS "numeroCuenta",
      (SELECT COUNT(*) FROM tramitadores_cuentas_cobro_lineas l WHERE l.cuenta_id = c.id AND l.tipo = 'TRAMITE')::int AS tramites,
      (SELECT COALESCE(SUM(l.valor), 0) FROM tramitadores_cuentas_cobro_lineas l WHERE l.cuenta_id = c.id AND l.tipo = 'TRAMITE') AS "valorTramites",
      (SELECT COALESCE(SUM(l.valor), 0) FROM tramitadores_cuentas_cobro_lineas l WHERE l.cuenta_id = c.id AND l.tipo = 'VISITA_FALLIDA') AS "valorVisitas",
      (SELECT COALESCE(SUM(l.valor), 0) FROM tramitadores_cuentas_cobro_lineas l WHERE l.cuenta_id = c.id AND l.tipo = 'ADICIONAL') AS "valorAdicionales",
      ${fechaBogota('c.enviada_en')} AS "enviadaEn", ${fechaBogota('c.aprobada_en')} AS "aprobadaEn",
      ${fechaBogota('c.visto_bueno_en')} AS "vistoBuenoEn",
      to_char(c.fecha_radicacion, 'YYYY-MM-DD') AS "fechaRadicacion", to_char(c.fecha_pago, 'YYYY-MM-DD') AS "fechaPago",
      c.motivo_anulacion AS "motivoAnulacion"
    FROM tramitadores_cuentas_cobro c
    JOIN "Tramitador" t ON t.id = c.tramitador_id
    ${where}
    ORDER BY c.semana DESC, c.consecutivo DESC
  `, { type: QueryTypes.SELECT, replacements: valores })

  const lineas = await db.query<Record<string, any>>(`
    SELECT c.consecutivo, c.estado, to_char(c.semana, 'YYYY-MM-DD') AS semana, t."nombreTramitador", t.identificacion,
      l.solicitud_tramite_id AS "tramiteId", COALESCE(s.placa, s."matriculaInmobiliaria") AS placa,
      cl."nombreCliente" AS cliente, o."nombreOperacion" AS operacion, l.centro_costos AS "centroCostos",
      l.tipo, l.concepto, to_char(l.fecha, 'YYYY-MM-DD') AS fecha, l.valor, (l.creada_por_tramitador IS NOT NULL) AS "delTramitador"
    FROM tramitadores_cuentas_cobro_lineas l
    JOIN tramitadores_cuentas_cobro c ON c.id = l.cuenta_id
    JOIN "Tramitador" t ON t.id = c.tramitador_id
    JOIN "SolicitudTramites" s ON s.id = l.solicitud_tramite_id
    LEFT JOIN "Clientes" cl ON cl.id = s."clienteId"
    LEFT JOIN "Operaciones" o ON o.id = l.operacion_id
    ${where}
    -- En el orden del anexo: por cuenta, trámite y fecha
    ORDER BY c.semana DESC, c.consecutivo DESC, l.solicitud_tramite_id, l.fecha, CASE l.tipo WHEN 'TRAMITE' THEN 0 ELSE 1 END, l.id
  `, { type: QueryTypes.SELECT, replacements: valores })

  const libro = XLSX.utils.book_new()
  const valoresCuenta = ['Valor trámites', 'Visitas fallidas', 'Adicionales', 'Total']

  XLSX.utils.book_append_sheet(libro, conFormatoPesos(hoja(cuentas.map(c => ({
    'Número': numeroCuentaTramitador(c.consecutivo),
    'Estado': NOMBRE_ESTADO[c.estado as EstadoCuentaTramitador] ?? c.estado,
    'Semana desde': c.semanaDesde,
    'Semana hasta': c.semana,
    'Tramitador': String(c.nombreTramitador ?? '').trim(),
    'Identificación': c.identificacion,
    'Ciudad': c.ciudad ?? '',
    'Banco': c.banco ?? '',
    'Tipo de cuenta': c.tipoCuenta ?? '',
    'Número de cuenta': c.numeroCuenta ?? '',
    'Trámites': c.tramites,
    'Valor trámites': aPesos(c.valorTramites),
    'Visitas fallidas': aPesos(c.valorVisitas),
    'Adicionales': aPesos(c.valorAdicionales),
    'Total': aPesos(c.total),
    'Enviada': c.enviadaEn ?? '',
    'Aprobada': c.aprobadaEn ?? '',
    'Visto bueno': c.vistoBuenoEn ?? '',
    'Radicación': c.fechaRadicacion ?? '',
    'Pago': c.fechaPago ?? '',
    'Motivo de anulación': c.motivoAnulacion ?? ''
  }))), valoresCuenta), 'Cuentas')

  XLSX.utils.book_append_sheet(libro, conFormatoPesos(hoja(lineas.map(l => ({
    'Cuenta': numeroCuentaTramitador(l.consecutivo),
    'Estado': NOMBRE_ESTADO[l.estado as EstadoCuentaTramitador] ?? l.estado,
    'Semana hasta': l.semana,
    'Tramitador': String(l.nombreTramitador ?? '').trim(),
    'Identificación': l.identificacion,
    'Trámite': l.tramiteId,
    'Placa / matrícula': l.placa ?? '',
    'Cliente': l.cliente ?? '',
    'Operación': l.operacion ?? '',
    'Centro de costos': l.centroCostos ?? '',
    'Tipo': NOMBRE_TIPO[l.tipo as TipoLineaCuenta] ?? l.tipo,
    'Concepto': l.concepto,
    'Fecha': l.fecha,
    'Valor': aPesos(l.valor),
    'Agregada por el tramitador': l.delTramitador ? 'Sí' : 'No'
  }))), ['Valor']), 'Detalle')

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
