import XLSX from 'xlsx'
import Estados from '../models/estados'

export const generarPlantillaEstados = async () => {

  const wb = XLSX.utils.book_new()

  // =========================
  // HOJA DATA (CARGA)
  // =========================
  const dataTemplate = [{
    solicitudTramiteId: '',
    estadoId: '',
    // Obligatoria con Novedad Subsanada Continuar Trámite (id 4): nueva entrega del resultado
    fechaEntregaResultado: ''
  }]

  const wsData = XLSX.utils.json_to_sheet(dataTemplate)
  XLSX.utils.book_append_sheet(wb, wsData, 'DATA')

  // =========================
  // HOJA ESTADOS (AYUDA)
  // =========================
  const estados = await Estados.findAll()

  const wsEstados = XLSX.utils.json_to_sheet(
    estados.map(e => {
      const json = e.toJSON()
      return {
        id: json.id,
        nombreEstado: json.nombreEstado
      }
    })
  )

  XLSX.utils.book_append_sheet(wb, wsEstados, 'ESTADOS')

  // =========================
  // EXPORTAR
  // =========================
  return XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx'
  })
}