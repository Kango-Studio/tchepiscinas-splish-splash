// Extrai telefone(s) e, quando houver evidência, o nome do contato a partir do
// texto reconhecido (OCR) de um print. Nunca completa dados ausentes: sem DDD
// não há telefone; sem sinal claro de nome, o nome fica vazio.
import { normalizeBrazilPhone } from "./phone";

export type ExtractedPhone = {
  normalized: string; // 55 + DDD + número
  raw: string; // trecho como apareceu no texto
  line: number; // índice da linha onde começa
};

export type PrintExtraction = {
  phones: ExtractedPhone[];
  name: string | null;
  nameReason: "unsaved_contact" | "next_to_phone" | "chat_header" | null;
};

// Telefone BR: +55 opcional, DDD (com ou sem parênteses/0), 9 opcional
// separado, 4 + 4 dígitos com pontuação opcional ("/" aparece como ruído do OCR).
const PHONE_RE =
  /(?<!\d)(?:\+?\s?55[\s./-]{0,2})?\(?\s?0?[1-9]\d\s?\)?[\s./-]{0,2}(?:9[\s./-]?)?\d{4}[\s./-]{0,2}\d{4}(?!\d)/g;

// Corrige confusões comuns do OCR apenas entre dígitos (ex.: "99I75" -> "99175").
function fixOcrDigits(line: string): string {
  return line
    .replace(/(?<=\d[\s.-]?)[OoQD](?=[\s.-]?\d)/g, "0")
    .replace(/(?<=\d[\s.-]?)[Il|](?=[\s.-]?\d)/g, "1");
}

export function extractPhones(text: string): ExtractedPhone[] {
  const seen = new Set<string>();
  const result: ExtractedPhone[] = [];
  const lines = text.split(/\r?\n/).map(fixOcrDigits);

  const collect = (source: string, lineIndex: number, breakAt?: number) => {
    for (const match of source.matchAll(PHONE_RE)) {
      const start = match.index ?? 0;
      // Ao juntar duas linhas, só aceita o número que atravessa a quebra.
      if (breakAt !== undefined && !(start < breakAt && start + match[0].length > breakAt + 1)) {
        continue;
      }
      const raw = match[0].trim();
      const normalized = normalizeBrazilPhone(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push({ normalized, raw, line: lineIndex });
    }
  };

  lines.forEach((line, i) => {
    collect(line, i);
    // O OCR costuma quebrar o número no fim da linha: "... é 51" / "99777-1122".
    const next = lines[i + 1];
    if (next) collect(`${line} ${next}`, i, line.length);
  });
  return result;
}

// Textos de interface do WhatsApp/celular e de conversa que nunca são nome.
const UI_WORDS = new Set([
  "online",
  "digitando",
  "gravando",
  "visto",
  "ultimo",
  "hoje",
  "ontem",
  "mensagem",
  "mensagens",
  "whatsapp",
  "conversa",
  "conversas",
  "contato",
  "contatos",
  "dados",
  "pesquisar",
  "chamada",
  "chamadas",
  "video",
  "audio",
  "voz",
  "arquivo",
  "foto",
  "fotos",
  "midia",
  "links",
  "docs",
  "criptografia",
  "ponta",
  "bloquear",
  "denunciar",
  "silenciar",
  "notificacoes",
  "recado",
  "status",
  "editar",
  "voltar",
  "clique",
  "toque",
  "adicionar",
  "salvar",
  "novo",
  "grupo",
  "grupos",
  "comunidades",
  "atualizacoes",
  "configuracoes",
  "empresa",
  "comercial",
  "ola",
  "oi",
  "bom",
  "boa",
  "dia",
  "tarde",
  "noite",
  "obrigado",
  "obrigada",
  "orcamento",
  "piscina",
  "tche",
  "lte",
  "wifi",
]);

const STATUS_RE =
  /\b(online|digitando|gravando|visto por [uú]ltimo|clique|toque (aqui|para)|dados do contato)\b/i;

const strip = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function cleanCandidate(line: string): string {
  const words = line
    .replace(/^[^\p{L}~]+/u, "") // setas/números lidos antes do nome
    .replace(/[^\p{L}'. -]+$/u, "") // lixo depois do nome
    .split(/\s+/)
    .filter(Boolean);
  // Ícones (seta, avatar) viram letras soltas: "D o Mariana Costa".
  while (words.length > 1 && (words[0].length === 1 || /^\p{Ll}{1,2}$/u.test(words[0]))) {
    words.shift();
  }
  return words.join(" ");
}

// Parece nome de pessoa/empresa: 1–4 palavras, só letras, iniciais maiúsculas.
export function looksLikeName(candidate: string): boolean {
  const value = cleanCandidate(candidate).replace(/^~\s*/, "");
  if (value.length < 3 || value.length > 40) return false;
  if (/\d/.test(value)) return false;
  const words = value.split(" ");
  if (words.length > 4) return false;
  const connectors = new Set(["da", "de", "do", "das", "dos", "e"]);
  for (const w of words) {
    if (connectors.has(w.toLowerCase())) continue;
    if (w.length < 2 || !/^\p{Lu}[\p{L}'.-]*$/u.test(w)) return false;
    if (UI_WORDS.has(strip(w).replace(/[^a-z]/g, ""))) return false;
  }
  return true;
}

const nameFrom = (line: string) => cleanCandidate(line).replace(/^~\s*/, "");

export function guessContactName(
  text: string,
  phones: ExtractedPhone[],
): Pick<PrintExtraction, "name" | "nameReason"> {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // 1) Contato não salvo: o WhatsApp mostra "~ Nome" ao lado do número.
  for (const line of lines) {
    const m = line.match(/~\s?(\p{L}[\p{L}'. -]{1,40})/u);
    if (m && looksLikeName(m[1])) return { name: nameFrom(m[1]), nameReason: "unsaved_contact" };
  }

  // 2) Tela de dados do contato: nome na linha imediatamente acima do telefone.
  if (phones.length === 1) {
    for (let i = phones[0].line - 1; i >= 0 && i >= phones[0].line - 2; i--) {
      if (!lines[i]) continue;
      if (looksLikeName(lines[i])) return { name: nameFrom(lines[i]), nameReason: "next_to_phone" };
      break;
    }
  }

  // 3) Cabeçalho da conversa: nome seguido de linha de status ("online",
  //    "visto por último..."), no topo do print.
  const top = lines.filter(Boolean).slice(0, 8);
  for (let i = 0; i < top.length - 1; i++) {
    if (STATUS_RE.test(top[i + 1]) && looksLikeName(top[i])) {
      return { name: nameFrom(top[i]), nameReason: "chat_header" };
    }
  }

  return { name: null, nameReason: null };
}

export function extractFromPrintText(text: string): PrintExtraction {
  const phones = extractPhones(text);
  return { phones, ...guessContactName(text, phones) };
}
