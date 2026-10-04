// Las fotos del celular pesan 3-8 MB. Antes de subirlas se reducen a un tamaño
// legible para una factura (máx. 2000 px por lado, JPEG) para que suban rápido
// con datos móviles. Los PDF y las imágenes ya livianas se dejan igual.
const LADO_MAXIMO = 2000
const CALIDAD = 0.82
const UMBRAL_BYTES = 1024 * 1024

export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.size <= UMBRAL_BYTES) return archivo

  try {
    // imageOrientation respeta la rotación con la que se tomó la foto
    const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" })
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height))
    const ancho = Math.round(imagen.width * escala)
    const alto = Math.round(imagen.height * escala)

    const lienzo = document.createElement("canvas")
    lienzo.width = ancho
    lienzo.height = alto
    const contexto = lienzo.getContext("2d")
    if (!contexto) return archivo
    contexto.drawImage(imagen, 0, 0, ancho, alto)
    imagen.close()

    const blob = await new Promise<Blob | null>(resolver => lienzo.toBlob(resolver, "image/jpeg", CALIDAD))
    if (!blob || blob.size >= archivo.size) return archivo

    const nombre = archivo.name.replace(/\.[^.]+$/, "") || "foto"
    return new File([blob], `${nombre}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
  } catch {
    // Si el navegador no puede procesarla (ej: HEIC), se sube la original
    return archivo
  }
}
