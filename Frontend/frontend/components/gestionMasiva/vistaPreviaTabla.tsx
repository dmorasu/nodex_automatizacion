'use client'

type ErrorExcel = {
  fila: number
  error: string
}

type RowData = Record<string, unknown>

type PreviewTableProps = {
  data: RowData[]
  errores: ErrorExcel[]
}

export default function PreviewTable({ data, errores }: PreviewTableProps) {

  const errorMap = new Map<number, string>()
  errores.forEach(e => errorMap.set(e.fila, e.error))

  const headers = Object.keys(data[0] || {})

  return (
    <div className="overflow-auto border rounded">

      <table className="min-w-full text-sm">

        <thead className="bg-gray-100">
          <tr>
            {headers.map(h => (
              <th key={h} className="p-2 border">{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, i) => {
            const fila = i + 2
            const tieneError = errorMap.has(fila)

            return (
              <tr
                key={i}
                className={tieneError ? 'bg-red-50' : ''}
              >
                {headers.map(h => (
                  <td key={h} className="p-2 border">
                    {String(row[h] ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>

      </table>

      {/* ERRORES */}
      {errores.length > 0 && (
        <div className="p-3 text-red-600">
          {errores.map(e => (
            <p key={e.fila}>
              Fila {e.fila}: {e.error}
            </p>
          ))}
        </div>
      )}

    </div>
  )
}