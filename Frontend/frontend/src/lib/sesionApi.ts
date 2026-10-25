import "server-only"
import { cookies } from "next/headers"

// Encabezado con el token de la sesión para llamar al backend desde el servidor
// (server actions y páginas). El backend exige sesión en todas las rutas de trámites.
export const encabezadosSesion = async (): Promise<Record<string, string>> => ({
  Authorization: `Bearer ${(await cookies()).get("TOKEN")?.value ?? ""}`
})
