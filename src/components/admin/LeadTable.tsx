import { useEffect, useMemo, useState } from "react";
import { Button, Pagination, Table, Tooltip, type SortDescriptor } from "@heroui/react";
import { Eye, TriangleExclamation } from "@gravity-ui/icons";
import { formatBrazilPhone } from "@/lib/leads/phone";
import { INTEREST_LABELS, type Lead } from "@/lib/leads/schema";
import { isOverdue, todayISO } from "./filters";
import { LeadWhatsAppButton, StageChip, formatDate } from "./ui";
import { FollowupDots } from "./FollowupCheckpoints";

const PAGE_SIZE = 10;

// Páginas visíveis com reticências: 1 … 4 5 6 … 12
function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < total);
  return [
    1,
    ...(around[0] > 2 ? (["…"] as const) : []),
    ...around,
    ...(around[around.length - 1] < total - 1 ? (["…"] as const) : []),
    total,
  ];
}

export function LeadTable({
  leads,
  onOpen,
  emptyContent,
  resetKey,
}: {
  leads: Lead[];
  resetKey: string;
  onOpen: (id: string) => void;
  emptyContent: React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDescriptor>({
    column: "created_at",
    direction: "descending",
  });

  const sorted = useMemo(() => {
    const list = [...leads];
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return sort.direction === "descending" ? list.reverse() : list;
  }, [leads, sort.direction]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  // Volta para a primeira página quando os filtros mudam o resultado.
  useEffect(() => setPage(1), [resetKey]);

  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const today = todayISO();
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, sorted.length);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Lista de leads"
          sortDescriptor={sort}
          onSortChange={setSort}
          onRowAction={(key) => onOpen(String(key))}
        >
          <Table.Header>
            <Table.Column id="name" isRowHeader>
              Nome
            </Table.Column>
            <Table.Column id="whatsapp">WhatsApp</Table.Column>
            <Table.Column id="city" className="hidden md:table-cell">
              Cidade
            </Table.Column>
            <Table.Column id="interest" className="hidden lg:table-cell">
              Interesse
            </Table.Column>
            <Table.Column id="stage">Etapa</Table.Column>
            <Table.Column id="followups" className="hidden lg:table-cell">
              Follow-ups
            </Table.Column>
            <Table.Column id="next_contact" className="hidden md:table-cell">
              Próximo contato
            </Table.Column>
            <Table.Column id="created_at" allowsSorting className="hidden sm:table-cell">
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>
                  Criado em
                </Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column id="actions" className="text-end">
              Ações
            </Table.Column>
          </Table.Header>
          <Table.Body items={pageItems} renderEmptyState={() => emptyContent}>
            {(lead) => {
              const overdue = isOverdue(lead, today);
              return (
                <Table.Row id={lead.id} className="cursor-pointer">
                  <Table.Cell>
                    <span className="font-medium whitespace-nowrap">{lead.name}</span>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {formatBrazilPhone(lead.whatsapp)}
                  </Table.Cell>
                  <Table.Cell className="hidden md:table-cell">{lead.city ?? "—"}</Table.Cell>
                  <Table.Cell className="hidden lg:table-cell">
                    {INTEREST_LABELS[lead.interest]}
                  </Table.Cell>
                  <Table.Cell>
                    <StageChip stage={lead.stage} />
                  </Table.Cell>
                  <Table.Cell className="hidden lg:table-cell">
                    <FollowupDots leadId={lead.id} />
                  </Table.Cell>
                  <Table.Cell className="hidden md:table-cell">
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap ${overdue ? "font-semibold text-danger" : ""}`}
                    >
                      {overdue && (
                        <TriangleExclamation className="size-3.5" aria-label="Atrasado" />
                      )}
                      {formatDate(lead.next_contact_date)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
                    {formatDate(lead.created_at)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1.5">
                      <LeadWhatsAppButton lead={lead} />
                      <Tooltip delay={300} closeDelay={0}>
                        <Tooltip.Trigger>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="tertiary"
                            className="rounded-full"
                            aria-label={`Ver detalhes de ${lead.name}`}
                            onPress={() => onOpen(lead.id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Ver detalhes</Tooltip.Content>
                      </Tooltip>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            }}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      {pages > 1 && (
        <Table.Footer>
          <Pagination size="sm">
            <Pagination.Summary>
              {first}–{last} de {sorted.length} leads
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Pagination.PreviousIcon />
                  <span className="hidden sm:inline">Anterior</span>
                </Pagination.Previous>
              </Pagination.Item>
              {pageList(page, pages).map((p, i) =>
                p === "…" ? (
                  <Pagination.Item key={`gap-${i}`}>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={p}>
                    <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
                      {p}
                    </Pagination.Link>
                  </Pagination.Item>
                ),
              )}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={page === pages}
                  onPress={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      )}
    </Table>
  );
}
