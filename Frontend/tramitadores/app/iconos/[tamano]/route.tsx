import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"

const TAMANOS = [32, 180, 192, 512]

// Logo nodextramitador.png (2075 × 758). El ícono usa solo el emblema de la derecha
// (persona, documento y círculos), recortado en un cuadro: el texto no se leería en pequeño.
const LOGO = { ancho: 2075, alto: 758 }
const EMBLEMA = { centroX: 1638, centroY: 375, lado: 720 }

let logoBase64: Promise<string> | null = null
const leerLogo = () =>
  (logoBase64 ??= readFile(path.join(process.cwd(), "public", "nodextramitador.png"))
    .then(archivo => `data:image/png;base64,${archivo.toString("base64")}`))

// Ícono de la app (pantalla de inicio, pestaña del navegador y manifiesto).
// El emblema ocupa el 84 % para quedar dentro de la zona segura de los íconos "maskable".
export async function GET(_req: Request, { params }: { params: { tamano: string } }) {
  const tamano = TAMANOS.includes(Number(params.tamano)) ? Number(params.tamano) : 192
  const escala = (tamano * 0.84) / EMBLEMA.lado

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "white" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={await leerLogo()}
          alt=""
          width={LOGO.ancho * escala}
          height={LOGO.alto * escala}
          style={{
            position: "absolute",
            left: tamano / 2 - EMBLEMA.centroX * escala,
            top: tamano / 2 - EMBLEMA.centroY * escala
          }}
        />
      </div>
    ),
    { width: tamano, height: tamano, headers: { "Cache-Control": "public, max-age=86400" } }
  )
}
