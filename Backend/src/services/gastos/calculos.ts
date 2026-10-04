// =====================================
// CÁLCULOS DE DINERO
// Se trabaja en centavos (enteros) para evitar errores de decimales
// de JavaScript (ej: 0.1 + 0.2 = 0.30000000000000004).
// =====================================

const aCentavos = (valor: number) => Math.round(valor * 100)

const aPesos = (centavos: number) => centavos / 100

export const redondear2 = (valor: number) => aPesos(aCentavos(valor))

// retención = base × porcentaje  |  total a pagar = base − retención
export const calcularRetencion = (baseRetencion: number, porcentaje: number) => {
  const baseCentavos = aCentavos(baseRetencion)
  const retencionCentavos = Math.round(baseCentavos * porcentaje)

  return {
    retencionFuente: aPesos(retencionCentavos),
    totalPagar: aPesos(baseCentavos - retencionCentavos)
  }
}

// 4x1000 = factura × tasa  |  legalizado = factura + 4x1000   (se usa en la fase 5)
export const calcularLegalizacion = (valorFactura: number, tasaGmf: number) => {
  const facturaCentavos = aCentavos(valorFactura)
  const gmfCentavos = Math.round(facturaCentavos * tasaGmf)

  return {
    cuatroXMil: aPesos(gmfCentavos),
    valorLegalizado: aPesos(facturaCentavos + gmfCentavos)
  }
}
