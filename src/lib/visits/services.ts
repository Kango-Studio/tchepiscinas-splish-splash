// Serviços de uma visita. As chaves são gravadas em visits.services; a lista
// também está na constraint visits_services_known (migration de visitas).

export const SERVICE_GROUPS = [
  {
    id: "limpeza",
    label: "Limpeza",
    services: [
      { key: "peneiracao", label: "Peneiração" },
      { key: "aspiracao_drenar", label: "Aspiração em drenar" },
      { key: "aspiracao_filtrar", label: "Aspiração em filtrar" },
      { key: "escovacao", label: "Escovação" },
      { key: "limpeza_bordas", label: "Limpeza de bordas" },
      { key: "limpeza_filtro", label: "Limpeza de filtro" },
      { key: "retrolavagem", label: "Retrolavagem" },
    ],
  },
  {
    id: "quimica",
    label: "Química e outros",
    services: [
      { key: "ajuste_parametros", label: "Ajuste dos parâmetros químicos" },
      { key: "cloro", label: "Cloro" },
      { key: "ph", label: "pH" },
      { key: "tratamento_choque", label: "Tratamento de choque" },
      { key: "ajuste_nivel_agua", label: "Ajuste do nível de água" },
      // "Outro" abre um campo de texto (visits.service_other).
      { key: "outro", label: "Outro" },
    ],
  },
] as const;

export type ServiceKey = (typeof SERVICE_GROUPS)[number]["services"][number]["key"];

export const SERVICE_LABELS = Object.fromEntries(
  SERVICE_GROUPS.flatMap((g) => g.services.map((s) => [s.key, s.label])),
) as Record<ServiceKey, string>;

export const SERVICE_KEYS = Object.keys(SERVICE_LABELS) as ServiceKey[];
