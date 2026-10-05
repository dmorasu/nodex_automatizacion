import { redirect } from "next/navigation"

// Los tramitadores ahora están en Catálogos; se deja para no romper enlaces viejos
export default function TramitadoresPage() {
  redirect("/center/catalogos?pestana=tramitadores")
}
