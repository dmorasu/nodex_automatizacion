import { Model, ModelStatic } from 'sequelize'

// Catálogo de estados guardado en memoria (código ↔ id).
// Los estados casi nunca cambian, así se evita consultarlos en cada operación.
export const catalogoEnMemoria = <C extends string>(modelo: ModelStatic<Model & { id?: number, codigo: string }>) => {
  let cache: { porCodigo: Map<string, number>, porId: Map<number, C> } | null = null

  const cargar = async () => {
    if (cache) return cache

    const registros = await modelo.findAll({ attributes: ['id', 'codigo'] })

    cache = {
      porCodigo: new Map(registros.map(r => [r.codigo, r.id])),
      porId: new Map(registros.map(r => [r.id, r.codigo as C]))
    }

    return cache
  }

  return {
    id: async (codigo: C): Promise<number> => {
      const id = (await cargar()).porCodigo.get(codigo)
      if (!id) throw new Error(`No existe el estado ${codigo} en ${modelo.name}`)
      return id
    },
    codigo: async (id: number): Promise<C> => (await cargar()).porId.get(id) as C
  }
}
