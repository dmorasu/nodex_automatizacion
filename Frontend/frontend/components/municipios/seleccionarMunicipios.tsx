'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@headlessui/react'
import { Search } from 'lucide-react'

export default function SelectMunicipioModal({ onSelect }: { onSelect: (municipio: any) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [municipios, setMunicipios] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filtered, setFiltered] = useState<any[]>([])
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>('')

  useEffect(() => {
    const getMunicipios = async () => {
      try {
        const response = await fetch(`/api/backend/municipios`)
        const data = await response.json()
        setMunicipios(data)
        setFiltered(data)
      } catch (error) {
        console.error('Error cargando municipios:', error)
      }
    }
    getMunicipios()
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    setFiltered(
      municipios.filter((m) =>
        m.nombreMunicipio.toLowerCase().includes(value.toLowerCase())
      )
    )
  }

  const handleSelect = (municipio: any) => {
    setSelectedMunicipio(municipio.nombreMunicipio)
    onSelect(municipio)
    setIsOpen(false)
  }

  return (
    <div className="w-full">
      {/* Campo que abre el modal */}
      <div
        className="border rounded-xl p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(true)}
      >
        {selectedMunicipio || 'Seleccionar municipio'}
      </div>

      {/* Modal */}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <Dialog.Title className="text-lg font-semibold mb-4 text-gray-800">
              Seleccionar municipio
            </Dialog.Title>

            {/* Input de búsqueda */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar municipio..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Lista de municipios */}
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {filtered.length > 0 ? (
                filtered.map((municipio) => (
                  <div
                    key={municipio.id}
                    onClick={() => handleSelect(municipio)}
                    className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                  >
                    {municipio.nombreMunicipio}
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-3">No se encontraron municipios</p>
              )}
            </div>

            {/* Botón cerrar */}
            <div className="mt-4 text-right">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  )
}
