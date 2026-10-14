import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
  type SortDescriptor,
} from "@heroui/react";
import { AlertTriangle, Eye } from "lucide-react";
import { formatBrazilPhone } from "@/lib/leads/phone";
import { INTEREST_LABELS, type Lead } from "@/lib/leads/schema";
import { isOverdue, todayISO } from "./filters";
import { LeadWhatsAppButton, StageChip, formatDate } from "./ui";
import { FollowupDots } from "./FollowupCheckpoints";

const PAGE_SIZE = 10;

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

  return (
    <div className="flex flex-col gap-3">
      <Table
        aria-label="Lista de leads"
        sortDescriptor={sort}
        onSortChange={setSort}
        onRowAction={(key) => onOpen(String(key))}
        classNames={{
          wrapper: "p-0 shadow-sm border border-default-200",
          th: "bg-pool-mist/60 text-pool-deep",
        }}
        bottomContent={
          pages > 1 ? (
            <div className="flex w-full items-center justify-between gap-2 px-3 pb-3">
              <span className="text-xs text-default-500">
                {sorted.length} leads · página {page} de {pages}
              </span>
              <Pagination size="sm" showControls page={page} total={pages} onChange={setPage} />
            </div>
          ) : null
        }
      >
        <TableHeader>
          <TableColumn key="name">NOME</TableColumn>
          <TableColumn key="whatsapp">WHATSAPP</TableColumn>
          <TableColumn key="city" className="hidden md:table-cell">
            CIDADE
          </TableColumn>
          <TableColumn key="interest" className="hidden lg:table-cell">
            INTERESSE
          </TableColumn>
          <TableColumn key="stage">ETAPA</TableColumn>
          <TableColumn key="followups" className="hidden lg:table-cell">
            FOLLOW-UPS
          </TableColumn>
          <TableColumn key="next_contact" className="hidden md:table-cell">
            PRÓXIMO CONTATO
          </TableColumn>
          <TableColumn key="created_at" allowsSorting className="hidden sm:table-cell">
            CRIADO EM
          </TableColumn>
          <TableColumn key="actions" align="end">
            AÇÕES
          </TableColumn>
        </TableHeader>
        <TableBody items={pageItems} emptyContent={emptyContent}>
          {(lead) => {
            const overdue = isOverdue(lead, today);
            return (
              <TableRow key={lead.id} className="cursor-pointer">
                <TableCell>
                  <span className="font-semibold">{lead.name}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatBrazilPhone(lead.whatsapp)}
                </TableCell>
                <TableCell className="hidden md:table-cell">{lead.city ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {INTEREST_LABELS[lead.interest]}
                </TableCell>
                <TableCell>
                  <StageChip stage={lead.stage} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <FollowupDots leadId={lead.id} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap ${overdue ? "font-semibold text-danger" : ""}`}
                  >
                    {overdue && <AlertTriangle className="size-3.5" aria-label="Atrasado" />}
                    {formatDate(lead.next_contact_date)}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap sm:table-cell">
                  {formatDate(lead.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <LeadWhatsAppButton lead={lead} />
                    <Tooltip content="Ver detalhes" closeDelay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        radius="full"
                        aria-label={`Ver detalhes de ${lead.name}`}
                        onPress={() => onOpen(lead.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          }}
        </TableBody>
      </Table>
    </div>
  );
}
