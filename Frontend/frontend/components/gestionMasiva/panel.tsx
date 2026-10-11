'use client'

import { toast } from 'react-toastify'
import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import PreviewTable from './vistaPreviaTabla'

type UploadPanelProps = {
  tipo: string
}

type ErrorExcel = {
  fila: number
  error: string
}

export default function UploadPanel({ tipo }: UploadPanelProps) {

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [errores, setErrores] = useState<ErrorExcel[]>([])
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const baseUrl = "/api/backend" // proxy del frontend: agrega el token de sesión

  // =========================
  // RESET COMPLETO
  // =========================
  const resetAll = () => {
    setFile(null)
    setData([])
    setErrores([])
    setMensaje(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // =========================
  // LEER EXCEL
  // =========================
  const handleFile = async (file: File) => {

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer)

    const sheet = workbook.Sheets['DATA']
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    setData(json)
    setErrores([])
    setMensaje(null)
  }

  // =========================
  // VALIDAR
  // =========================
  const validar = async () => {

    if (!file) return toast.error('Selecciona un archivo')

    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${baseUrl}/bulk/${tipo}/validar`, {
      method: 'POST',
      body: formData
    })

    const json = await res.json()

    setErrores(json.errores || [])
    setMensaje(
      json.errores?.length
        ? 'Se encontraron errores ❌'
        : 'Validación exitosa ✅'
    )

    setLoading(false)
  }

  // =========================
  // CARGAR
  // =========================
  const cargar = async () => {

    if (!file) return toast.error('Selecciona un archivo')

    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${baseUrl}/bulk/${tipo}/procesar`, {
      method: 'POST',
      body: formData
    })

    const json = await res.json()

    setMensaje(json.message || 'Proceso completado')

    setLoading(false)

    // 🔥 RESET + REFRESH
    setTimeout(() => {
      resetAll()
      window.location.reload()
    }, 1500)
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6 border">

      {/* HEADER */}
<div className="flex justify-between items-center">
  <h2 className="text-lg font-semibold capitalize">
    Proceso: {tipo}
  </h2>

  <div className="flex gap-2">

    {/* Volver al Dashboard */}
    <button
      onClick={() => window.location.href = '/center/dashboard'}
      className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded-lg text-sm"
    >
      ← Volver
    </button>

    {/* Descargar plantilla */}
    <button
      onClick={() =>
        window.open(`${baseUrl}/bulk/${tipo}/plantilla`)
      }
      className="bg-green-300 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm"
    >
      📄 Descargar plantilla
    </button>

  </div>
</div>

      {/* INPUT */}
      <div className="border-dashed border-2 border-gray-300 rounded-xl p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return

            setFile(f)
            handleFile(f)
          }}
          className="mx-auto"
        />
        <p className="text-sm text-gray-500 mt-2">
          Carga tu archivo Excel (hoja DATA)
        </p>
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">

        <button
          onClick={validar}
          disabled={loading}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Validando...' : 'Validar'}
        </button>

        <button
          onClick={cargar}
          disabled={loading || errores.length > 0}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Procesando...' : 'Cargar'}
        </button>

        <button
          onClick={resetAll}
          className="px-4 bg-gray-200 hover:bg-gray-300 rounded-lg"
        >
          Reset
        </button>

      </div>

      {/* MENSAJE */}
      {mensaje && (
        <div className="p-3 rounded-lg text-sm bg-gray-100 border">
          {mensaje}
        </div>
      )}

      {/* PREVIEW */}
      {data.length > 0 && (
        <PreviewTable data={data} errores={errores} />
      )}

    </div>
  )
}