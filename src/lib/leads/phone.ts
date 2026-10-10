// Telefones brasileiros normalizados como 55 + DDD + número, apenas dígitos.
// Ex.: "(51) 99175-7029" -> "5551991757029"

// DDDs em uso no Brasil (Anatel).
const VALID_DDDS = new Set(
  (
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 " +
    "51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 " +
    "91 92 93 94 95 96 97 98 99"
  ).split(" "),
);

export function normalizeBrazilPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;

  // Remove prefixos de discagem: 0 + operadora (ex.: 0 21 51 9...), ou 00 55
  if (digits.startsWith("0055")) digits = digits.slice(2);
  else if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12))
    digits = digits.slice(1);
  else if (digits.startsWith("0") && (digits.length === 13 || digits.length === 14))
    digits = digits.slice(3);

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!VALID_DDDS.has(ddd)) return null;
  // Celular: 9 dígitos começando com 9. Fixo: 8 dígitos começando com 2-5.
  if (number.length === 9 && !number.startsWith("9")) return null;
  if (number.length === 8 && !/^[2-5]/.test(number)) return null;

  return `55${ddd}${number}`;
}

export function formatBrazilPhone(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  if (number.length === 9) return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return normalized;
}

// Máscara enquanto o usuário digita.
export function maskBrazilPhoneInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function whatsappChatLink(normalized: string, message?: string): string {
  const base = `https://wa.me/${normalized.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
