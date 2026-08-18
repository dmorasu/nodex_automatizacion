import {
  ShareServiceClient,
  ShareDirectoryClient,
} from "@azure/storage-file-share";

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING;

const shareName =
  process.env.AZURE_FILE_SHARE_NAME;

if (!connectionString) {
  throw new Error(
    "No está configurada AZURE_STORAGE_CONNECTION_STRING"
  );
}

if (!shareName) {
  throw new Error(
    "No está configurada AZURE_FILE_SHARE_NAME"
  );
}

const serviceClient =
  ShareServiceClient.fromConnectionString(
    connectionString
  );

const shareClient =
  serviceClient.getShareClient(shareName);


export const crearDirectorio = async (
  ruta: string
): Promise<ShareDirectoryClient> => {

  const partes = ruta
    .split("/")
    .filter(Boolean);

  let rutaActual = "";

  for (const parte of partes) {

    rutaActual = rutaActual
      ? `${rutaActual}/${parte}`
      : parte;

    const directoryClient =
      shareClient.getDirectoryClient(rutaActual);

    await directoryClient.createIfNotExists();
  }

  return shareClient.getDirectoryClient(ruta);
};


export const archivoExiste = async (
  rutaDirectorio: string,
  nombreArchivo: string
): Promise<boolean> => {

  const directoryClient =
    shareClient.getDirectoryClient(rutaDirectorio);

  const fileClient =
    directoryClient.getFileClient(nombreArchivo);

  return await fileClient.exists();
};


export const subirArchivo = async (
  rutaDirectorio: string,
  nombreArchivo: string,
  buffer: Buffer
): Promise<string> => {

  const directoryClient =
    await crearDirectorio(rutaDirectorio);

  const fileClient =
    directoryClient.getFileClient(nombreArchivo);

  await fileClient.create(buffer.length);

  await fileClient.uploadData(buffer);

  return `${rutaDirectorio}/${nombreArchivo}`;
};


export const obtenerArchivo = async (
  rutaDirectorio: string,
  nombreArchivo: string
): Promise<Buffer> => {

  const directoryClient =
    shareClient.getDirectoryClient(
      rutaDirectorio
    );

  const fileClient =
    directoryClient.getFileClient(
      nombreArchivo
    );

  return await fileClient.downloadToBuffer();
};


export const eliminarArchivo = async (
  rutaDirectorio: string,
  nombreArchivo: string
): Promise<void> => {

  const directoryClient =
    shareClient.getDirectoryClient(
      rutaDirectorio
    );

  const fileClient =
    directoryClient.getFileClient(
      nombreArchivo
    );

  await fileClient.deleteIfExists();
};