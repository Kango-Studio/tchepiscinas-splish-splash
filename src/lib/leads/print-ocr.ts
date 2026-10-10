// OCR de prints no navegador com Tesseract.js (carregado sob demanda).
// A imagem é processada localmente e nunca é enviada ao servidor/Supabase;
// apenas o worker e o modelo de português são baixados (e cacheados) da CDN.

export const PRINT_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PRINT_MAX_BYTES = 8 * 1024 * 1024;

export function validatePrintFile(file: File): string | null {
  if (!(PRINT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Formato não suportado. Envie uma imagem PNG, JPG ou WEBP.";
  }
  if (file.size > PRINT_MAX_BYTES) {
    return "Imagem muito grande. O limite é 8 MB.";
  }
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

export type OcrProgress = { stage: "loading" | "recognizing"; progress: number };

// Escala de cinza, ampliação de prints pequenos e inversão de modo escuro
// melhoram bastante o reconhecimento de capturas de tela.
async function preprocess(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Não foi possível abrir a imagem. O arquivo pode estar corrompido.");
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(2, Math.max(1, 1600 / Math.max(bitmap.width, 1)), 4000 / longest);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = gray;
    sum += gray;
  }
  if (sum / (px.length / 4) < 110) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  ctx.putImageData(image, 0, 0);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/png"));
}

export async function recognizePrint(
  file: File,
  onProgress?: (p: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  onProgress?.({ stage: "loading", progress: 0 });
  const [{ createWorker }, image] = await Promise.all([import("tesseract.js"), preprocess(file)]);
  if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");

  const worker = await createWorker("por", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text")
        onProgress?.({ stage: "recognizing", progress: m.progress });
      else onProgress?.({ stage: "loading", progress: m.progress });
    },
  });
  const abort = () => void worker.terminate();
  signal?.addEventListener("abort", abort);
  try {
    const { data } = await worker.recognize(image);
    return data.text ?? "";
  } finally {
    signal?.removeEventListener("abort", abort);
    await worker.terminate().catch(() => undefined);
  }
}
