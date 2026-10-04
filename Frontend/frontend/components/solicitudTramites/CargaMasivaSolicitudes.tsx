'use client'

import { useState } from 'react'

export default function CargaMasivaSolicitudes() {

  const [file,setFile] = useState<File | null>(null)
  const [loading,setLoading] = useState(false)
  const [resultado,setResultado] = useState<any>(null)

  const handleUpload = async () => {
    if(!file) return

    setLoading(true)
    setResultado(null)

    const formData = new FormData()
    formData.append('file',file)

    const res = await fetch(`/api/backend/solicitudTramites/carga-masiva`,{
      method:'POST',
      body: formData
    })

    const json = await res.json()
    setResultado(json)
    setLoading(false)
  }

  return (
    <div className="border p-6 rounded-xl shadow space-y-4 max-w-xl">

      <h2 className="text-xl font-bold">Carga masiva de trámites</h2>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e)=> setFile(e.target.files?.[0] || null)}
        className="border p-2 rounded w-full"
      />

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        {loading ? 'Procesando...' : 'Subir archivo'}
      </button>

      {resultado && (
        <div className="bg-gray-50 p-3 rounded text-sm space-y-2">
          <p><strong>Total procesados:</strong> {resultado.totalProcesados}</p>
          <p><strong>Filas creadas:</strong> {resultado.creados.length}</p>
          <p><strong>Errores:</strong> {resultado.errores.length}</p>

          {resultado.errores.length > 0 && (
            <ul className="text-red-600 list-disc ml-5">
              {resultado.errores.map((e:any,i:number)=>(
                <li key={i}>Fila {e.fila}: {e.motivo}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
