import {
  ShareServiceClient,
  ShareDirectoryClient,
  StorageSharedKeyCredential,
  generateFileSASQueryParameters,
  FileSASPermissions,
  SASProtocol
} from "@azure/storage-file-share"


const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING


const shareName =
  process.env.AZURE_FILE_SHARE_NAME


if (!connectionString) {

  throw new Error(
    "No está configurada AZURE_STORAGE_CONNECTION_STRING"
  )

}


if (!shareName) {

  throw new Error(
    "No está configurada AZURE_FILE_SHARE_NAME"
  )

}


// ==========================================
// CLIENTE AZURE
// ==========================================

const serviceClient =
  ShareServiceClient.fromConnectionString(
    connectionString
  )


const shareClient =
  serviceClient.getShareClient(
    shareName
  )


// ==========================================
// CREDENCIALES PARA SAS
// ==========================================

const accountName =
  connectionString.match(
    /AccountName=([^;]+)/
  )?.[1]


const accountKey =
  connectionString.match(
    /AccountKey=([^;]+)/
  )?.[1]


if (!accountName) {

  throw new Error(
    "No se pudo obtener el AccountName de Azure"
  )

}


if (!accountKey) {

  throw new Error(
    "No se pudo obtener el AccountKey de Azure"
  )

}


const sharedKeyCredential =
  new StorageSharedKeyCredential(

    accountName,

    accountKey

  )


// ==========================================
// CREAR DIRECTORIO
// ==========================================

export const crearDirectorio = async (

  ruta: string

): Promise<ShareDirectoryClient> => {

  const partes = ruta
    .split("/")
    .filter(Boolean)


  let rutaActual = ""


  for (
    const parte
    of partes
  ) {

    rutaActual =
      rutaActual

        ? `${rutaActual}/${parte}`

        : parte


    const directoryClient =
      shareClient.getDirectoryClient(
        rutaActual
      )


    await directoryClient.createIfNotExists()

  }


  return shareClient.getDirectoryClient(
    ruta
  )

}


// ==========================================
// VALIDAR ARCHIVO
// ==========================================

export const archivoExiste = async (

  rutaDirectorio: string,

  nombreArchivo: string

): Promise<boolean> => {

  const directoryClient =
    shareClient.getDirectoryClient(
      rutaDirectorio
    )


  const fileClient =
    directoryClient.getFileClient(
      nombreArchivo
    )


  return await fileClient.exists()

}


// ==========================================
// SUBIR ARCHIVO
// ==========================================

export const subirArchivo = async (

  rutaDirectorio: string,

  nombreArchivo: string,

  buffer: Buffer

): Promise<string> => {

  const directoryClient =
    await crearDirectorio(
      rutaDirectorio
    )


  const fileClient =
    directoryClient.getFileClient(
      nombreArchivo
    )


  await fileClient.create(
    buffer.length
  )


  await fileClient.uploadData(
    buffer
  )


  return `${rutaDirectorio}/${nombreArchivo}`

}


// ==========================================
// OBTENER ARCHIVO
// ==========================================

export const obtenerArchivo = async (

  rutaDirectorio: string,

  nombreArchivo: string

): Promise<Buffer> => {

  const directoryClient =
    shareClient.getDirectoryClient(
      rutaDirectorio
    )


  const fileClient =
    directoryClient.getFileClient(
      nombreArchivo
    )


  return await fileClient.downloadToBuffer()

}


// ==========================================
// ELIMINAR ARCHIVO
// ==========================================

export const eliminarArchivo = async (

  rutaDirectorio: string,

  nombreArchivo: string

): Promise<void> => {

  const directoryClient =
    shareClient.getDirectoryClient(
      rutaDirectorio
    )


  const fileClient =
    directoryClient.getFileClient(
      nombreArchivo
    )


  await fileClient.deleteIfExists()

}


// ==========================================
// GENERAR URL SAS TEMPORAL
// ==========================================

export const generarUrlArchivoSAS = async (

  rutaDirectorio: string,

  nombreArchivo: string,

  minutosValidez = 60

): Promise<string> => {

  try {

    console.log(
      "🔐 GENERANDO URL SAS PARA ARCHIVO:",
      `${rutaDirectorio}/${nombreArchivo}`
    )


    const fechaInicio =
      new Date(
        Date.now() - 5 * 60 * 1000
      )


    const fechaExpiracion =
      new Date(
        Date.now() +
        minutosValidez * 60 * 1000
      )


    const sasToken =
      generateFileSASQueryParameters(

        {

          shareName,

          filePath:
            `${rutaDirectorio}/${nombreArchivo}`,

          permissions:
            FileSASPermissions.parse(
              "r"
            ),

          startsOn:
            fechaInicio,

          expiresOn:
            fechaExpiracion,

          protocol:
            SASProtocol.Https

        },

        sharedKeyCredential

      ).toString()


    const url =
      `https://${accountName}.file.core.windows.net/` +
      `${shareName}/` +
      `${rutaDirectorio}/` +
      `${nombreArchivo}` +
      `?${sasToken}`


    console.log(
      "✅ URL SAS GENERADA"
    )


    return url

  } catch (error) {

    console.error(
      "❌ ERROR GENERANDO URL SAS:",
      error
    )


    throw error

  }

}