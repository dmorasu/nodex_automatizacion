import { redirect } from "next/navigation"

// La raíz entra directo al Dashboard (como Gastos y Tramitadores); sin sesión, el guard de /center manda al login
export default function Home() {
  redirect("/center/dashboard")
}
