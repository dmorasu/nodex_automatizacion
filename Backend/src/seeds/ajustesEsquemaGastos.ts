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

export const ajustarEsquemaGastos = async () => {
  await retencionPasaALaFactura()
  await contabilizacionDeGastos()
  await retencionAlCrearGasto()
}
