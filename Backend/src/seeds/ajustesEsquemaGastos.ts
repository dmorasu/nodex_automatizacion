import { db } from '../config/db'

// =====================================
// AJUSTES DE ESQUEMA DEL MÓDULO DE GASTOS
// sync() crea tablas nuevas pero no modifica las existentes. Estos ajustes
// cambian tablas ya creadas y se pueden ejecutar en cada arranque sin efecto
// repetido (cada uno revisa antes si hace falta).
// =====================================

const columnasDe = async (tabla: string) => {
  try {
    return await db.getQueryInterface().describeTable(tabla)
  } catch {
    return null // la tabla aún no existe
  }
}

// 2026-10-01 · La retención pasa del gasto a la factura real (gastos_facturas).
// El gasto ahora solo lleva el valor solicitado.
const retencionPasaALaFactura = async () => {
  const columnas = await columnasDe('gastos_solicitudes')
  if (!columnas) return

  // Las columnas viejas dejan de ser obligatorias (se conservan los datos)
  for (const columna of ['base_retencion', 'porcentaje_retencion', 'retencion_fuente', 'total_pagar']) {
    if (columnas[columna] && !columnas[columna].allowNull) {
      await db.query(`ALTER TABLE gastos_solicitudes ALTER COLUMN ${columna} DROP NOT NULL`)
    }
  }

  // Los gastos creados antes del cambio toman como valor solicitado su total a pagar
  if (columnas.total_pagar) {
    await db.query(`
      UPDATE gastos_solicitudes
      SET valor_solicitado_pago = total_pagar
      WHERE valor_solicitado_pago IS NULL AND total_pagar IS NOT NULL
    `)
  }

  if (columnas.valor_solicitado_pago?.allowNull) {
    await db.query(`
      UPDATE gastos_solicitudes SET valor_solicitado_pago = 0 WHERE valor_solicitado_pago IS NULL
    `)
    await db.query(`ALTER TABLE gastos_solicitudes ALTER COLUMN valor_solicitado_pago SET NOT NULL`)
  }
}

// 2026-10-02 · Los gastos NO reembolsables se contabilizan uno a uno (sin cuenta de cobro):
// el documento contable queda en el propio gasto.
const contabilizacionDeGastos = async () => {
  const columnas = await columnasDe('gastos_solicitudes')
  if (!columnas) return

  if (!columnas.documento_contable) {
    await db.query(`ALTER TABLE gastos_solicitudes ADD COLUMN documento_contable VARCHAR(50)`)
  }
  if (!columnas.fecha_contabilizacion) {
    await db.query(`ALTER TABLE gastos_solicitudes ADD COLUMN fecha_contabilizacion TIMESTAMP WITH TIME ZONE`)
  }
  if (!columnas.contabilizado_por) {
    await db.query(`ALTER TABLE gastos_solicitudes ADD COLUMN contabilizado_por INTEGER REFERENCES "Usuarios" (id)`)
  }
}

// 2026-10-02 · La retención vuelve al gasto, pero solo para inmuebles y con columnas
// nuevas (las viejas base_retencion, etc. conservan su historial sin tocarse).
const retencionAlCrearGasto = async () => {
  const columnas = await columnasDe('gastos_solicitudes')
  if (!columnas) return

  const nuevas: [string, string][] = [
    ['retencion_base', 'DECIMAL(15, 2)'],
    ['retencion_porcentaje', 'DECIMAL(10, 6)'],
    ['retencion_valor', 'DECIMAL(15, 2)'],
    ['retencion_total_pagar', 'DECIMAL(15, 2)']
  ]
  for (const [columna, tipo] of nuevas) {
    if (!columnas[columna]) await db.query(`ALTER TABLE gastos_solicitudes ADD COLUMN ${columna} ${tipo}`)
  }
}

// 2026-10-06 · Pago en tres pasos: Tesorería programa → Dirección de Negocio aprueba →
// Tesorería adjunta el soporte del banco y confirma. Los lotes que ya existían quedan PAGADO.
const pagoProgramado = async () => {
  const lotes = await columnasDe('gastos_lotes_pago')
  if (lotes) {
    const nuevas: [string, string][] = [
      ['estado', `VARCHAR(20) NOT NULL DEFAULT 'PAGADO'`],
      ['aprobado_por', 'INTEGER REFERENCES "Usuarios" (id)'],
      ['fecha_aprobacion', 'TIMESTAMP WITH TIME ZONE'],
      ['confirmado_por', 'INTEGER REFERENCES "Usuarios" (id)'],
      ['fecha_confirmacion', 'TIMESTAMP WITH TIME ZONE']
    ]
    for (const [columna, tipo] of nuevas) {
      if (!lotes[columna]) await db.query(`ALTER TABLE gastos_lotes_pago ADD COLUMN ${columna} ${tipo}`)
    }
  }

  const gastos = await columnasDe('gastos_solicitudes')
  if (gastos && !gastos.valor_programado) {
    await db.query(`ALTER TABLE gastos_solicitudes ADD COLUMN valor_programado DECIMAL(15, 2)`)
  }

  // Los estados nuevos van entre Solicitado y Pagado: se reordenan los existentes
  const orden: [string, number][] = [
    ['SOLICITADO', 1], ['PROGRAMADO', 2], ['APROBADO_PAGO', 3], ['PAGADO', 4], ['FACTURADO', 5],
    ['EN_CUENTA_COBRO', 6], ['LEGALIZADO', 7], ['CONTABILIZADO', 8]
  ]
  for (const [codigo, posicion] of orden) {
    await db.query(`UPDATE gastos_estados_gasto SET orden = :posicion WHERE codigo = :codigo AND orden <> :posicion`, { replacements: { codigo, posicion } })
  }
}

// 2026-10-07 · Anticipos de clientes del banco: bolsas de tipo ANTICIPOS con saldo por cliente.
// Las tablas nuevas (gastos_anticipos, gastos_clientes_empresariales, gastos_trazabilidad_anticipos)
// las crea sync(); aquí se agregan las columnas a las tablas que ya existían.
const anticiposDeClientes = async () => {
  const agregar = async (tabla: string, nuevas: [string, string][]) => {
    const columnas = await columnasDe(tabla)
    if (!columnas) return
    for (const [columna, tipo] of nuevas) {
      if (!columnas[columna]) await db.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`)
    }
  }

  await agregar('gastos_bolsas', [['tipo', `VARCHAR(20) NOT NULL DEFAULT 'GENERAL'`]])
  await agregar('gastos_terceros', [['telefono', 'VARCHAR(30)'], ['direccion', 'VARCHAR(200)']])
  await agregar('gastos_solicitudes', [['anticipo_id', 'INTEGER REFERENCES gastos_anticipos (id) ON UPDATE CASCADE ON DELETE SET NULL']])
  await agregar('gastos_movimientos_bolsa', [
    ['cliente_id', 'INTEGER REFERENCES gastos_terceros (id) ON UPDATE CASCADE ON DELETE SET NULL'],
    ['anticipo_id', 'INTEGER REFERENCES gastos_anticipos (id) ON UPDATE CASCADE ON DELETE SET NULL']
  ])
  await agregar('gastos_documentos', [['anticipo_id', 'INTEGER REFERENCES gastos_anticipos (id) ON UPDATE CASCADE ON DELETE SET NULL']])

  // 2026-10-07 · El número de solicitud del anticipo es su código (ANT-…): se quita la columna
  // que se pedía aparte (solo existió en desarrollo, antes del primer despliegue)
  const anticipos = await columnasDe('gastos_anticipos')
  if (anticipos?.numero_solicitud) await db.query('ALTER TABLE gastos_anticipos DROP COLUMN numero_solicitud')

  // Saldo de cada cliente = suma de sus movimientos en la bolsa
  await db.query(`CREATE INDEX IF NOT EXISTS gastos_movimientos_bolsa_cliente ON gastos_movimientos_bolsa (bolsa_id, cliente_id) WHERE cliente_id IS NOT NULL`)
  await db.query(`CREATE INDEX IF NOT EXISTS gastos_solicitudes_anticipo ON gastos_solicitudes (anticipo_id) WHERE anticipo_id IS NOT NULL`)
}

// 2026-10-10 · Solicitudes de factura: misma tabla de anticipos con su clase y la factura que
// adjunta Contabilidad. Los anticipos que ya existen quedan como ANTICIPO por el DEFAULT
const solicitudesDeFactura = async () => {
  const columnas = await columnasDe('gastos_anticipos')
  if (!columnas) return
  const nuevas: [string, string][] = [
    ['clase', `VARCHAR(20) NOT NULL DEFAULT 'ANTICIPO'`],
    ['numero_factura', 'VARCHAR(50)'],
    ['fecha_facturacion', 'TIMESTAMP WITH TIME ZONE']
  ]
  for (const [columna, tipo] of nuevas) {
    if (!columnas[columna]) await db.query(`ALTER TABLE gastos_anticipos ADD COLUMN ${columna} ${tipo}`)
  }
  await db.query(`CREATE INDEX IF NOT EXISTS gastos_anticipos_clase_estado ON gastos_anticipos (clase, estado)`)
}

export const ajustarEsquemaGastos = async () => {
  await retencionPasaALaFactura()
  await contabilizacionDeGastos()
  await retencionAlCrearGasto()
  await pagoProgramado()
  await anticiposDeClientes()
  await solicitudesDeFactura()
}
