// Helper del navegador para disparar la descarga de un archivo.
// Separado del módulo `pdf/` (que es puro) porque usa APIs del DOM.

export function descargarArchivo(
  bytes: Uint8Array,
  nombre: string,
  tipo = "application/pdf",
): void {
  // Copiamos a un ArrayBuffer propio para satisfacer el tipo BlobPart
  // (Uint8Array puede estar respaldado por un SharedArrayBuffer).
  const buffer = bytes.slice().buffer;
  const blob = new Blob([buffer], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Firefox y Safari a veces cancelan la descarga si el blob se libera antes de
  // que el navegador termine de engancharla, así que el revoke va diferido. El
  // costo de esperar son unos KB en memoria; el de revocar temprano, un PDF o
  // un respaldo que no se descarga y sin ningún error a la vista.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
