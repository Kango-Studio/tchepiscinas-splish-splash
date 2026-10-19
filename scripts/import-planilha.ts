// Importação única da planilha "Controle de Visitas" (abas Piscineiros,
// Clientes e Visitas) para o Supabase. O gasto de produtos é importado à
// parte, com --produtos (correspondência de nomes aprovada pela gestora).
//
// Simulação (não grava nada, mostra o relatório):
//   node --env-file=.env scripts/import-planilha.ts "C:/caminho/Controle de Visitas.xlsx"
// Gravação (só roda com as tabelas vazias e sem pendências):
//   node --env-file=.env scripts/import-planilha.ts "C:/caminho/Controle de Visitas.xlsx" --gravar
// Gasto de produtos (simulação; acrescente --gravar para gravar):
//   node --env-file=.env scripts/import-planilha.ts "C:/caminho/Controle de Visitas.xlsx" --produtos
//
// Usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env (ignora o RLS; roda só
// no computador, nunca no navegador).

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { SERVICE_LABELS, type ServiceKey } from "../src/lib/visits/services.ts";
import { normalizeBrazilPhone } from "../src/lib/leads/phone.ts";

// ---------------------------------------------------------------------------
// Decisões da importação (preenchidas com as respostas da gestora)
// ---------------------------------------------------------------------------

// Nome usado na aba Visitas -> nome do cliente na aba Clientes.
const CLIENT_ALIASES: Record<string, string> = {
  Anderson: "Anderson Farias",
  "Djulia Beatriz": "Djulia Bartz",
};

// Clientes que aparecem só na aba Visitas: cadastrados como inativos para
// manter o histórico. O piscineiro é o da visita mais recente.
const EXTRA_CLIENTS = [
  "Marcia Viviane Moraes Batista",
  "Jaqueline",
  "Schaiani Assines Cardoso",
  "Renilda Marcedo de Bitencourt",
  "Ana Maria",
];
const EXTRA_CLIENTS_PLAN = "Prata Antigo";

// Texto da aba Visitas (normalizado) -> serviço padronizado. Variações óbvias
// de grafia; o resto vem de SERVICE_LABELS.
const SERVICE_ALIASES: Record<string, ServiceKey> = {
  "retro-lavagem": "retrolavagem",
  "ajuste dos parametros": "ajuste_parametros",
};

// Texto da aba Visitas -> "Outro" com descrição.
const SERVICE_AS_OTHER: Record<string, string> = {
  aspiracao: "Aspiração",
  "entrega do kit acqua tche": "Entrega do kit Acqua Tchê",
};

// O que fazer com a observação "P" da aba Clientes (undefined = indefinido,
// null = descartar).
const NOTE_P_AS: string | null | undefined = null;

// Visitas do mesmo cliente no mesmo dia viram uma só (a registrada primeiro),
// com os serviços somados. Cada visita vale um pagamento no fechamento.
const MERGE_SAME_DAY_VISITS = true;

// ---------------------------------------------------------------------------

const TZ_OFFSET = "-03:00"; // São Paulo, sem horário de verão desde 2019

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
  }
  return v;
}

function sheetRows(wb: ExcelJS.Workbook, name: string): unknown[][] {
  const ws = wb.worksheets.find((w) => norm(w.name) === norm(name));
  if (!ws) throw new Error(`Aba "${name}" não encontrada`);
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
    if (values.some((v) => clean(v instanceof Date ? "x" : v))) rows.push(values);
  });
  return rows;
}

// O exceljs devolve datas do Excel como UTC "de parede".
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const isoDateTime = (d: Date) => `${d.toISOString().slice(0, 19)}${TZ_OFFSET}`;

// "Última Visita" da aba Clientes mistura formatos; só para conferência.
function parseSheetDate(v: unknown): string | null {
  if (v instanceof Date) return isoDate(v);
  const s = clean(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/AAAA
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/); // M/D/AA (formato americano)
  if (m) return `20${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/); // DD/MM (sem ano)
  if (m) return `2026-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parsePrice(v: unknown): number | "parceria" | null {
  const s = norm(v);
  if (!s) return null;
  if (s.includes("parceria")) return "parceria";
  const n = Number(s.replace(/[^\d.,]/g, "").replace(/,(\d{2})$/, ".$1"));
  return Number.isFinite(n) ? n : null;
}

const planName = (v: unknown) => clean(v).replace(/^plano\s+/i, "");

const SERVICE_BY_LABEL = new Map(
  (Object.entries(SERVICE_LABELS) as [ServiceKey, string][]).map(([k, l]) => [norm(l), k]),
);

type Problem = string;

// ---------------------------------------------------------------------------
// Gasto de produtos (etapa 8): nomes antigos -> produtos padronizados,
// correspondência aprovada pela gestora.
// ---------------------------------------------------------------------------

const PRODUCT_ALIASES: Record<string, string> = {
  "3kg cloro": "Cloro 3kg",
  "2,5kg cloro": "Cloro 2,5kg",
  "cloro granulado": "Cloro granulado",
  "3kg de dicloro": "Dicloro 3kg",
  "balde de cloro": "Cloro balde 10kg",
  "sulfato de aluminio": "Sulfato de alumínio 2kg",
  "sulfato de aluminio 2kg": "Sulfato de alumínio 2kg",
  "2kg sulfato": "Sulfato de alumínio 2kg",
  barrilha: "Barrilha 1,5kg",
  "1,5 kg barrilha": "Barrilha 1,5kg",
  algicida: "Algicida 1L",
  "algicida 1 litro": "Algicida 1L",
  "algicida choque": "Algicida 1L",
  clarificante: "Clarificante 1L",
  alcalinizante: "Elevador de alcalinidade",
};

async function importProducts(wb: ExcelJS.Workbook, apply: boolean) {
  const rows = sheetRows(wb, "Gasto de Produtos")
    .slice(1)
    .filter((r) => clean(r[2]));
  const blocking: Problem[] = [];
  const usages = rows.flatMap((r, i) => {
    const line = i + 3;
    const product = PRODUCT_ALIASES[norm(r[2])];
    if (!product) blocking.push(`Linha ${line}: produto "${clean(r[2])}" sem correspondência`);
    if (!(r[0] instanceof Date)) blocking.push(`Linha ${line}: data inválida "${clean(r[0])}"`);
    const quantity = Number(r[3]);
    if (!(quantity > 0)) blocking.push(`Linha ${line}: quantidade inválida "${clean(r[3])}"`);
    // Células com fórmula (ex.: IA do Google Sheets) não são observação de verdade.
    const rawNotes = r[4];
    const notes = typeof rawNotes === "string" && clean(rawNotes) ? clean(rawNotes) : null;
    if (!product || !(r[0] instanceof Date) || !(quantity > 0)) return [];
    return [
      {
        line,
        used_on: isoDate(r[0]),
        tech: clean(r[1]),
        product,
        quantity,
        notes,
        original: clean(r[2]),
      },
    ];
  });

  const productNames = [...new Set(Object.values(PRODUCT_ALIASES))].sort();
  console.log(`\nProdutos padronizados: ${productNames.length}`);
  for (const p of productNames) {
    const from = [...new Set(usages.filter((u) => u.product === p).map((u) => u.original))];
    const total = usages.filter((u) => u.product === p).reduce((s, u) => s + u.quantity, 0);
    console.log(`  ${p.padEnd(26)} ${String(total).padStart(3)} itens  <- ${from.join(" | ")}`);
  }
  console.log(`\nLançamentos: ${usages.length} de ${rows.length} linhas`);
  const byTech = new Map<string, number>();
  for (const u of usages) byTech.set(u.tech, (byTech.get(u.tech) ?? 0) + u.quantity);
  for (const [t, n] of byTech) console.log(`  ${t}: ${n} itens`);
  if (blocking.length) {
    console.log(`\nPendências (${blocking.length}):`);
    for (const b of blocking) console.log(`  ✗ ${b}`);
  }
  if (!apply) {
    console.log("\nSimulação concluída. Nada foi gravado.");
    return;
  }
  if (blocking.length) {
    console.error("\nResolva as pendências antes de gravar.");
    process.exit(1);
  }

  const db = supabaseAdmin();
  const { count, error: countErr } = await db
    .from("product_usages")
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;
  if (count)
    throw new Error(`product_usages já tem ${count} registros. A importação só roda uma vez.`);

  const { data: techRows, error: techErr } = await db.from("pool_techs").select("id, name");
  if (techErr) throw techErr;
  const techId = new Map(techRows.map((t) => [norm(t.name), t.id as string]));
  const missingTech = [...new Set(usages.map((u) => u.tech))].filter((t) => !techId.has(norm(t)));
  if (missingTech.length) throw new Error(`Piscineiros não cadastrados: ${missingTech.join(", ")}`);

  // Reaproveita produtos já cadastrados no painel com o mesmo nome.
  const { data: existing, error: prodErr } = await db.from("products").select("id, name");
  if (prodErr) throw prodErr;
  const productId = new Map(existing.map((p) => [norm(p.name), p.id as string]));
  const toCreate = productNames.filter((p) => !productId.has(norm(p)));
  if (toCreate.length) {
    const { data: created, error } = await db
      .from("products")
      .insert(toCreate.map((name) => ({ name })))
      .select("id, name");
    if (error) throw error;
    for (const p of created) productId.set(norm(p.name), p.id as string);
  }

  const { error: usageErr } = await db.from("product_usages").insert(
    usages.map((u) => ({
      used_on: u.used_on,
      pool_tech_id: techId.get(norm(u.tech)),
      product_id: productId.get(norm(u.product)),
      quantity: u.quantity,
      notes: u.notes,
    })),
  );
  if (usageErr) throw usageErr;
  console.log(`\nGravado: ${toCreate.length} produtos novos, ${usages.length} lançamentos.`);
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error(
      'Uso: node --env-file=.env scripts/import-planilha.ts "<planilha.xlsx>" [--produtos] [--gravar]',
    );
    process.exit(1);
  }
  const apply = flags.includes("--gravar");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  if (flags.includes("--produtos")) return importProducts(wb, apply);

  const blocking: Problem[] = [];
  const warnings: Problem[] = [];

  // --- Piscineiros -----------------------------------------------------------
  const techRows = sheetRows(wb, "Piscineiros").slice(1);
  const techs = techRows
    .filter((r) => clean(r[0]))
    .map((r) => {
      const rawPhone = clean(r[1]);
      const whatsapp = rawPhone ? normalizeBrazilPhone(rawPhone) : null;
      if (rawPhone && !whatsapp)
        warnings.push(`Telefone inválido do piscineiro ${clean(r[0])}: "${rawPhone}" (fica vazio)`);
      return { name: clean(r[0]), whatsapp, rawPhone };
    });
  const techByNorm = new Map(techs.map((t) => [norm(t.name), t]));
  const requireTech = (v: unknown, where: string) => {
    const t = techByNorm.get(norm(v));
    if (!t) blocking.push(`Piscineiro "${clean(v)}" (${where}) não está na aba Piscineiros`);
    return t?.name ?? null;
  };

  // --- Planos (já cadastrados pela migration) --------------------------------
  const PLANS: Record<string, number> = {
    "prata antigo": 300,
    "prata novo": 400,
    recorrente: 397,
    "gold + produtos": 599.8,
  };

  // --- Clientes --------------------------------------------------------------
  const clientRows = sheetRows(wb, "Clientes")
    .slice(1)
    .filter((r) => clean(r[1]));
  const notesP: string[] = [];
  const clients = clientRows.map((r) => {
    const name = clean(r[1]);
    const situacao = norm(r[2]);
    if (situacao !== "ativo" && situacao !== "inativo")
      blocking.push(`Situação desconhecida para ${name}: "${clean(r[2])}"`);
    const plan = planName(r[6]);
    const planDefault = PLANS[norm(plan)];
    if (planDefault === undefined)
      blocking.push(`Plano desconhecido para ${name}: "${clean(r[6])}"`);
    const price = parsePrice(r[4]);
    let custom_price: number | null = null;
    let billing_type: "pago" | "parceria" = "pago";
    if (price === "parceria") billing_type = "parceria";
    else if (price === null) warnings.push(`Valor vazio para ${name} (usa o valor do plano)`);
    else if (planDefault !== undefined && Math.abs(price - planDefault) > 0.001)
      custom_price = price;

    let notes: string | null = clean(r[10]) || null;
    if (notes === "P") {
      notesP.push(name);
      notes = NOTE_P_AS === undefined ? notes : NOTE_P_AS;
    }
    return {
      legacy_id: Number(clean(r[0])) || null,
      name,
      active: situacao !== "inativo",
      neighborhood: clean(r[3]) || null,
      tech: requireTech(r[5], `cliente ${name}`),
      plan: Object.keys(PLANS).find((p) => p === norm(plan)) ?? plan,
      planDefault,
      custom_price,
      billing_type,
      notes,
      sheetLastVisit: parseSheetDate(r[7]),
      sheetLastVisitRaw: clean(r[7] instanceof Date ? isoDate(r[7]) : r[7]),
    };
  });
  if (notesP.length && NOTE_P_AS === undefined)
    blocking.push(
      `Observação "P" em ${notesP.length} clientes (${notesP.join(", ")}): o que significa?`,
    );

  const visitRows = sheetRows(wb, "Visitas").slice(1);

  for (const name of EXTRA_CLIENTS) {
    const latest = visitRows
      .filter((r) => norm(r[3]) === norm(name) && r[1] instanceof Date)
      .sort((a, b) => (a[1] as Date).getTime() - (b[1] as Date).getTime())
      .at(-1);
    if (!latest) blocking.push(`Cliente extra "${name}" não tem visitas na aba Visitas`);
    clients.push({
      legacy_id: null,
      name,
      active: false,
      neighborhood: null,
      tech: latest ? requireTech(latest[2], `cliente extra ${name}`) : null,
      plan: norm(EXTRA_CLIENTS_PLAN),
      planDefault: PLANS[norm(EXTRA_CLIENTS_PLAN)],
      custom_price: null,
      billing_type: "pago",
      notes: "Cadastrado na importação: aparecia só no histórico de visitas.",
      sheetLastVisit: null,
      sheetLastVisitRaw: "",
    });
  }

  const dupNames = clients.filter(
    (c, i) => clients.findIndex((o) => norm(o.name) === norm(c.name)) !== i,
  );
  for (const d of dupNames) blocking.push(`Cliente duplicado: ${d.name}`);
  const clientByNorm = new Map(clients.map((c) => [norm(c.name), c]));
  const aliasByNorm = new Map(Object.entries(CLIENT_ALIASES).map(([a, n]) => [norm(a), norm(n)]));

  // --- Visitas ---------------------------------------------------------------
  const unknownClients = new Map<string, number>();
  const unknownServices = new Map<string, number>();
  const notesToReview: string[] = [];
  const rawVisits = visitRows.flatMap((r, i) => {
    const line = i + 2;
    const clientName = clean(r[3]);
    const client = clientByNorm.get(aliasByNorm.get(norm(clientName)) ?? norm(clientName));
    if (!client) {
      unknownClients.set(clientName, (unknownClients.get(clientName) ?? 0) + 1);
      return [];
    }
    if (!(r[1] instanceof Date)) {
      blocking.push(`Linha ${line}: data da visita inválida "${clean(r[1])}"`);
      return [];
    }
    const visit_date = isoDate(r[1]);
    const created_at = r[0] instanceof Date ? isoDateTime(r[0]) : null;

    const services = new Set<ServiceKey>();
    const others: string[] = [];
    const tokens = String(r[4] ?? "")
      .split(/[,\n]/)
      .map((t) => t.replace(/^[\s*•-]+/, "").trim())
      .filter(Boolean);
    for (const t of tokens) {
      const n = norm(t);
      const key = SERVICE_BY_LABEL.get(n) ?? SERVICE_ALIASES[n];
      if (key) services.add(key);
      else if (SERVICE_AS_OTHER[n] !== undefined) {
        services.add("outro");
        others.push(SERVICE_AS_OTHER[n]);
      } else unknownServices.set(n, (unknownServices.get(n) ?? 0) + 1);
    }

    const notes = String(r[5] ?? "").trim() || null;
    if (notes && /choque|nivel/.test(norm(notes)))
      notesToReview.push(`${visit_date} · ${client.name} · "${notes.replace(/\s*\n\s*/g, " / ")}"`);

    return [
      {
        line,
        client: client.name,
        tech: requireTech(r[2], `visita linha ${line}`),
        visit_date,
        created_at,
        services: [...services],
        service_other: others.length ? others.join(", ") : null,
        notes,
      },
    ];
  });

  for (const [name, count] of unknownClients) {
    const first = norm(name).split(" ")[0];
    const candidates = clients
      .filter((c) => norm(c.name).split(" ")[0] === first)
      .map((c) => c.name);
    blocking.push(
      `Cliente "${name}" (${count} visita${count > 1 ? "s" : ""}) não está na aba Clientes` +
        (candidates.length ? ` — parecido com: ${candidates.join(", ")}` : ""),
    );
  }
  for (const [token, count] of unknownServices)
    blocking.push(`Serviço "${token}" (${count}x) não corresponde a nenhum serviço da lista`);

  const sameDay = new Map<string, typeof rawVisits>();
  for (const v of rawVisits) {
    const k = `${v.client} em ${v.visit_date}`;
    sameDay.set(k, [...(sameDay.get(k) ?? []), v]);
  }
  const visits = MERGE_SAME_DAY_VISITS ? [] : rawVisits;
  for (const [k, group] of sameDay) {
    if (group.length > 1)
      warnings.push(
        `Visita repetida no mesmo dia (${group.length}x): ${k}` +
          (MERGE_SAME_DAY_VISITS ? " — unidas numa só" : ""),
      );
    if (!MERGE_SAME_DAY_VISITS) continue;
    const [first, ...rest] = group.sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? ""),
    );
    const joinDistinct = (values: (string | null)[]) =>
      [...new Set(values.filter((x): x is string => !!x))].join(", ") || null;
    visits.push({
      ...first,
      services: [...new Set(group.flatMap((v) => v.services))],
      service_other: joinDistinct(group.map((v) => v.service_other)),
      notes: joinDistinct([first.notes, ...rest.map((v) => v.notes)]),
    });
  }

  // --- Relatório ---------------------------------------------------------------
  console.log(`\nPiscineiros: ${techs.length}`);
  for (const t of techs) console.log(`  ${t.name.padEnd(10)} ${t.whatsapp ?? "(sem telefone)"}`);

  const custom = clients.filter((c) => c.custom_price !== null || c.billing_type === "parceria");
  console.log(`\nClientes: ${clients.length} (${clients.filter((c) => c.active).length} ativos)`);
  console.log("Valores diferentes do plano:");
  for (const c of custom)
    console.log(
      `  ${c.name}: ${c.billing_type === "parceria" ? "Parceria" : `R$ ${c.custom_price}`} (plano ${c.plan}, padrão R$ ${c.planDefault})`,
    );

  console.log(`\nVisitas: ${visits.length} de ${visitRows.length} linhas`);
  const lastVisit = new Map<string, string>();
  const perClient = new Map<string, number>();
  for (const v of visits) {
    perClient.set(v.client, (perClient.get(v.client) ?? 0) + 1);
    if ((lastVisit.get(v.client) ?? "") < v.visit_date) lastVisit.set(v.client, v.visit_date);
  }
  console.log(
    "\nCliente                              Visitas  Última (calculada)  Última (planilha)",
  );
  for (const c of clients) {
    const calc = lastVisit.get(c.name) ?? "—";
    const diff = c.sheetLastVisit && calc !== c.sheetLastVisit ? "  ⚠ diferente" : "";
    console.log(
      `  ${c.name.slice(0, 34).padEnd(35)}${String(perClient.get(c.name) ?? 0).padStart(5)}    ${calc.padEnd(18)}  ${c.sheetLastVisitRaw}${diff}`,
    );
  }

  console.log(
    `\nObservações com "tratamento de choque" ou "nível de água" (${notesToReview.length}), importadas só como observação:`,
  );
  for (const n of notesToReview) console.log(`  ${n}`);

  if (warnings.length) {
    console.log(`\nAvisos (${warnings.length}):`);
    for (const w of warnings) console.log(`  · ${w}`);
  }
  if (blocking.length) {
    console.log(`\nPendências que impedem a gravação (${blocking.length}):`);
    for (const b of [...new Set(blocking)]) console.log(`  ✗ ${b}`);
  }

  if (!apply) {
    console.log("\nSimulação concluída. Nada foi gravado.");
    return;
  }
  if (blocking.length) {
    console.error("\nResolva as pendências antes de gravar.");
    process.exit(1);
  }

  // --- Gravação ----------------------------------------------------------------
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  const db = createClient(url, key, { auth: { persistSession: false } });

  for (const table of ["pool_techs", "clients", "visits"]) {
    const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message} (a migration foi aplicada?)`);
    if (count)
      throw new Error(`A tabela ${table} já tem ${count} registros. A importação só roda uma vez.`);
  }

  const { data: planRows, error: planErr } = await db.from("plans").select("id, name");
  if (planErr) throw planErr;
  const planId = new Map(planRows.map((p) => [norm(p.name), p.id as string]));

  const { data: techIns, error: techErr } = await db
    .from("pool_techs")
    .insert(techs.map((t) => ({ name: t.name, whatsapp: t.whatsapp })))
    .select("id, name");
  if (techErr) throw techErr;
  const techId = new Map(techIns.map((t) => [t.name, t.id as string]));

  const { data: clientIns, error: clientErr } = await db
    .from("clients")
    .insert(
      clients.map((c) => ({
        legacy_id: c.legacy_id,
        name: c.name,
        active: c.active,
        neighborhood: c.neighborhood,
        pool_tech_id: c.tech ? techId.get(c.tech) : null,
        plan_id: planId.get(norm(c.plan)),
        custom_price: c.custom_price,
        billing_type: c.billing_type,
        notes: c.notes,
      })),
    )
    .select("id, name");
  if (clientErr) throw clientErr;
  const clientId = new Map(clientIns.map((c) => [c.name, c.id as string]));

  const payload = visits.map((v) => ({
    client_id: clientId.get(v.client),
    pool_tech_id: techId.get(v.tech!),
    visit_date: v.visit_date,
    services: v.services,
    service_other: v.service_other,
    notes: v.notes,
    ...(v.created_at ? { created_at: v.created_at } : {}),
  }));
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await db.from("visits").insert(payload.slice(i, i + 200));
    if (error) {
      console.error(
        "\nFalha ao gravar visitas. Para recomeçar, rode no SQL Editor:\n" +
          "  delete from public.visits; delete from public.clients; delete from public.pool_techs;",
      );
      throw error;
    }
  }

  console.log(
    `\nGravado: ${techIns.length} piscineiros, ${clientIns.length} clientes, ${payload.length} visitas.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
