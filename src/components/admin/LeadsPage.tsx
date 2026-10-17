import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Skeleton, Tabs } from "@heroui/react";
import {
  ArrowRotateRight,
  CircleExclamation,
  LayoutColumns3,
  ListUl,
  Plus,
  SquareDashedText,
  Tray,
} from "@gravity-ui/icons";
import type { Lead, LeadStage } from "@/lib/leads/schema";
import { describeDbError, useLeads, useUpdateStage } from "./leads-api";
import {
  EMPTY_FILTERS,
  applyLeadFilters,
  distinctCities,
  hasActiveFilters,
  type LeadFilters,
} from "./filters";
import { LeadFiltersBar } from "./LeadFiltersBar";
import { LeadStats } from "./LeadStats";
import { LeadKanban } from "./LeadKanban";
import { LeadTable } from "./LeadTable";
import { LeadDrawer, type DrawerState } from "./LeadDrawer";
import { PrintImportModal } from "./PrintImportModal";
import { PendingLabel } from "./ui";

export type LeadsView = "kanban" | "lista";

export function LeadsPage({
  view,
  onViewChange,
}: {
  view: LeadsView;
  onViewChange: (v: LeadsView) => void;
}) {
  const leadsQuery = useLeads();
  const updateStage = useUpdateStage();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [printOpen, setPrintOpen] = useState(false);

  // A prévia do print vive só na memória do navegador; libera ao sair do cadastro.
  const printPreviewUrl = drawer.mode === "create" ? drawer.fromPrint?.previewUrl : undefined;
  useEffect(() => {
    return () => {
      if (printPreviewUrl) URL.revokeObjectURL(printPreviewUrl);
    };
  }, [printPreviewUrl]);

  const allLeads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const cities = useMemo(() => distinctCities(allLeads), [allLeads]);
  // Kanban e cards de resumo ignoram o filtro de etapa (as colunas já são as etapas).
  const funnelLeads = useMemo(
    () => applyLeadFilters(allLeads, filters, { includeStage: false }),
    [allLeads, filters],
  );
  const listLeads = useMemo(
    () => applyLeadFilters(allLeads, filters, { includeStage: true }),
    [allLeads, filters],
  );

  const openLead = useCallback((id: string) => setDrawer({ mode: "edit", leadId: id }), []);
  const moveLead = useCallback(
    (lead: Lead, stage: LeadStage) =>
      updateStage.mutate({ id: lead.id, stage, previous: lead.stage }),
    [updateStage],
  );

  const filtersActive = hasActiveFilters(filters);
  const noLeadsAtAll = leadsQuery.isSuccess && allLeads.length === 0;

  const filteredEmpty = (
    <EmptyState className="flex flex-col items-center gap-2 py-10 text-center">
      <Tray className="size-8 text-muted" />
      <p className="text-sm text-muted">Nenhum lead encontrado com esses filtros.</p>
      <Button size="sm" variant="tertiary" onPress={() => setFilters(EMPTY_FILTERS)}>
        Limpar filtros
      </Button>
    </EmptyState>
  );

  return (
    // Tabs envolve a página: a lista de abas fica no cabeçalho e os painéis no conteúdo.
    <Tabs
      selectedKey={view}
      onSelectionChange={(k) => onViewChange(k as LeadsView)}
      className="gap-5"
    >
      <div className="animate-admin-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
            Leads
          </h1>
          <p className="text-sm text-muted">Acompanhe os contatos do funil de vendas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Modo de visualização">
              <Tabs.Tab id="kanban" className="gap-1.5">
                <LayoutColumns3 className="size-4" />
                Kanban
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="lista" className="gap-1.5">
                <Tabs.Separator />
                <ListUl className="size-4" />
                Lista
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Button onPress={() => setDrawer({ mode: "create" })}>
            <Plus className="size-4" />
            Novo lead
          </Button>
          <Button variant="secondary" onPress={() => setPrintOpen(true)}>
            <SquareDashedText className="size-4" />
            Cadastrar por print
          </Button>
        </div>
      </div>

      <LeadStats leads={funnelLeads} isLoading={leadsQuery.isPending} filtered={filtersActive} />

      <LeadFiltersBar
        filters={filters}
        onChange={setFilters}
        cities={cities}
        showStage={view === "lista"}
      />

      {leadsQuery.isError ? (
        <Card className="animate-admin-rise border border-danger/30">
          <Card.Content className="items-center gap-3 py-10 text-center">
            <CircleExclamation className="size-8 text-danger" />
            <div>
              <p className="font-semibold">Não foi possível carregar os leads</p>
              <p className="text-sm text-muted">{describeDbError(leadsQuery.error)}</p>
            </div>
            <Button
              variant="tertiary"
              onPress={() => leadsQuery.refetch()}
              isPending={leadsQuery.isFetching}
            >
              {({ isPending }) => (
                <PendingLabel isPending={isPending} icon={<ArrowRotateRight className="size-4" />}>
                  Tentar novamente
                </PendingLabel>
              )}
            </Button>
          </Card.Content>
        </Card>
      ) : leadsQuery.isPending ? (
        <div className="skeleton--shimmer flex gap-3 overflow-hidden" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex w-70 shrink-0 flex-col gap-2.5 rounded-2xl bg-surface-secondary p-3 xl:flex-1"
            >
              <Skeleton animationType="none" className="h-5 w-28 rounded-md" />
              <Skeleton animationType="none" className="h-28 rounded-xl" />
              <Skeleton animationType="none" className="h-28 rounded-xl" />
            </div>
          ))}
        </div>
      ) : noLeadsAtAll ? (
        <Card className="animate-admin-rise">
          <EmptyState className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-pool-mist text-pool">
              <Tray className="size-8" />
            </span>
            <div>
              <p className="font-semibold">Nenhum lead ainda</p>
              <p className="text-sm text-muted">
                Os pedidos do formulário do site aparecem aqui. Você também pode cadastrar
                manualmente.
              </p>
            </div>
            <Button onPress={() => setDrawer({ mode: "create" })}>
              <Plus className="size-4" />
              Cadastrar primeiro lead
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <>
          <Tabs.Panel id="kanban" className="animate-admin-rise flex flex-col gap-3">
            {filtersActive && funnelLeads.length === 0 && <Card>{filteredEmpty}</Card>}
            <LeadKanban leads={funnelLeads} onOpen={openLead} onMove={moveLead} />
          </Tabs.Panel>
          <Tabs.Panel id="lista" className="animate-admin-rise">
            <LeadTable
              leads={listLeads}
              onOpen={openLead}
              resetKey={JSON.stringify(filters)}
              emptyContent={filteredEmpty}
            />
          </Tabs.Panel>
        </>
      )}

      <LeadDrawer
        state={drawer}
        leads={allLeads}
        onClose={() => setDrawer({ mode: "closed" })}
        onOpenLead={openLead}
      />

      <PrintImportModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        onContinue={(fromPrint) => {
          setPrintOpen(false);
          setDrawer({ mode: "create", fromPrint });
        }}
      />
    </Tabs>
  );
}
