// El controller recibe un Express.Multer.File real (con disk storage).
// El worker de BullMQ solo recibe el path serializado dentro del job (no puede
// pasarse el objeto File completo por Redis), así que el service acepta esta
// interfaz mínima con lo único que realmente usa: path y originalname.
export interface ArchivoPlanilla {
  path: string;
  originalname: string;
}
