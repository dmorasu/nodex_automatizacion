import { readFile } from "fs/promises"
import path from "path"
import { obtenerSesion } from "@/src/auth/dal"

export const dynamic = "force-dynamic"

// Manual de usuario de Nodex (menú → Manual Nodex). Es un solo archivo, el mismo para Trámites y
// Gastos: se lee de docs/ en la raíz del repositorio (la app corre desde Frontend/gastos).
// Solo con sesión.
export async function GET() {
  await obtenerSesion()
  const html = await readFile(path.join(process.cwd(), "..", "..", "docs", "manual-usuario-nodex.html"), "utf8")
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } })
}
