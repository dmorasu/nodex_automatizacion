import XLSX from 'xlsx'
import Transportadora from '../models/trasnportadora'

export const generarPlantillaLogistica = async () => {

  const wb = XLSX.utils.book_new()

  // =========================
  // HOJA DATA (CARGA)
  // =========================
  const dataTemplate = [{
    solicitudTramiteId: '',
    numeroGuia: '',
    destinatario: '',
    // Sí / No. Con Sí el valor del envío va vacío; con No es obligatorio
    pagoContraEntrega: 'No',
    valorEnvio: '',
    fechaProgramacionLogistica: '',
    fechaEntregaTransportadora: '',
    transportadoraId: ''
  }]

  const wsData = XLSX.utils.json_to_sheet(dataTemplate)

  XLSX.utils.book_append_sheet(wb, wsData, 'DATA')

  // =========================
  // HOJA AYUDA TRANSPORTADORAS
  // =========================
  const transportadoras = await Transportadora.findAll()

  const wsTransportadoras = XLSX.utils.json_to_sheet(
  transportadoras.map(t => {
    const json = t.toJSON()

    return {
      id: json.id,
      nombreTransportadora: json.nombreTransportadora
    }
  })
)

  XLSX.utils.book_append_sheet(wb, wsTransportadoras, 'TRANSPORTADORAS')

  // =========================
  // GENERAR ARCHIVO
  // =========================
  return XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx'
  })
}