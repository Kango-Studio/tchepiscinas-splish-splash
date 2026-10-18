import { toBlob } from "html-to-image";

// Relatórios em PNG gerados no navegador. Nada é enviado ao Supabase
// (plano gratuito): a imagem pode ser gerada de novo a qualquer momento.

export async function nodeToPngFile(node: HTMLElement, filename: string): Promise<File> {
  // Sem as fontes carregadas, a imagem sai com a fonte padrão do sistema.
  await document.fonts.ready;
  const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
  if (!blob) throw new Error("Não foi possível gerar a imagem.");
  return new File([blob], filename, { type: "image/png" });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Compartilhar arquivos (WhatsApp etc.) existe no celular e em alguns navegadores de computador.
export function canShareFiles(file?: File) {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  const probe = file ?? new File([new Blob()], "teste.png", { type: "image/png" });
  return navigator.canShare({ files: [probe] });
}

export async function shareFile(file: File, text: string): Promise<"shared" | "cancelled"> {
  try {
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

// "Gabriel Santiago" -> "gabriel-santiago"
export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
