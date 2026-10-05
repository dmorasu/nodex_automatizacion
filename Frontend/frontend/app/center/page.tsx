import { redirect } from "next/navigation"

// El listado de trámites vive en el Dashboard; /center queda solo para no romper enlaces viejos
export default function CenterPage() {
  redirect("/center/dashboard")
}
