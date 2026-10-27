import { db } from '../config/db'

// =====================================
// AJUSTES DE ESQUEMA PARA LA APP DE TRAMITADORES
// sync() no modifica tablas existentes. Cada ajuste revisa antes si hace falta,
// así que se puede ejecutar en cada arranque.
// =====================================

// 2026-10-02 · Los tramitadores suben documentos al trámite desde su app:
// el documento lo sube un usuario O un tramitador
const documentosDelTramitador = async () => {
  let columnas
  try {
    columnas = await db.getQueryInterface().describeTable('DocumentosSolicitud')
  } catch {
    return // la tabla aún no existe: sync() la crea con el modelo actual
  }

  if (!columnas.usuarioId?.allowNull) {
    await db.query(`ALTER TABLE "DocumentosSolicitud" ALTER COLUMN "usuarioId" DROP NOT NULL`)
  }
  if (!columnas.tramitadorId) {
    await db.query(`
      ALTER TABLE "DocumentosSolicitud"
      ADD COLUMN "tramitadorId" INTEGER REFERENCES "Tramitador" (id) ON UPDATE CASCADE ON DELETE SET NULL
    `)
  }
  // Clase de documento elegida por el tramitador (Soporte, Factura u Otro)
  if (!columnas.tipoDocumento) {
    await db.query(`ALTER TABLE "DocumentosSolicitud" ADD COLUMN "tipoDocumento" VARCHAR(30)`)
  }
}

// 2026-10-25 · Cuentas de cobro de tramitadores: datos que salen en el PDF y la firma del tramitador
const datosCuentaCobro = async () => {
  let columnas
  try {
    columnas = await db.getQueryInterface().describeTable('Tramitador')
  } catch {
    return
  }
  const nuevas: [string, string][] = [
    ['direccion', 'VARCHAR(200)'],
    ['ciudad', 'VARCHAR(100)'],
    ['banco', 'VARCHAR(100)'],
    ['tipoCuenta', 'VARCHAR(20)'],
    ['numeroCuenta', 'VARCHAR(50)'],
    ['declaracionArt383', 'BOOLEAN NOT NULL DEFAULT true'],
    ['firmaRuta', 'VARCHAR(500)'],
    ['firmaNombre', 'VARCHAR(255)']
  ]
  for (const [columna, tipo] of nuevas) {
    if (!columnas[columna]) await db.query(`ALTER TABLE "Tramitador" ADD COLUMN "${columna}" ${tipo}`)
  }
}

// 2026-10-27 · Cuentas de cobro fases 2 y 3: retención (en centavos, la vigente; el cálculo de Nodex
// queda en calculo_retencion) y la bolsa con que se pagó. Si la tabla aún no existe la crea sync()
const retencionYPagoCuentaCobro = async () => {
  let columnas
  try {
    columnas = await db.getQueryInterface().describeTable('tramitadores_cuentas_cobro')
  } catch {
    return
  }
  const nuevas: [string, string][] = [
    ['retencion', 'BIGINT'],
    ['calculo_retencion', 'JSONB'],
    ['retencion_ajustada', 'BOOLEAN NOT NULL DEFAULT false'],
    ['bolsa_id', 'INTEGER']
  ]
  for (const [columna, tipo] of nuevas) {
    if (!columnas[columna]) await db.query(`ALTER TABLE tramitadores_cuentas_cobro ADD COLUMN ${columna} ${tipo}`)
  }
}

export const ajustarEsquemaTramitadores = async () => {
  await documentosDelTramitador()
  await datosCuentaCobro()
  await retencionYPagoCuentaCobro()
}
