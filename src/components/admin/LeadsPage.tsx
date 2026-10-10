import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, Skeleton, Tab, Tabs } from "@heroui/react";
import { AlertCircle, Inbox, KanbanSquare, List, Plus, RefreshCw, ScanText } from "lucide-react";
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
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox className="size-8 text-default-300" />
      <p className="text-sm text-default-500">Nenhum lead encontrado com esses filtros.</p>
      <Button size="sm" variant="flat" color="primary" onPress={() => setFilters(EMPTY_FILTERS)}>
        Limpar filtros
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-pool-deep md:text-3xl">Leads</h1>
          <p className="text-sm text-default-500">Acompanhe os contatos do funil de vendas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            aria-label="Modo de visualização"
            selectedKey={view}
            onSelectionChange={(k) => onViewChange(k as LeadsView)}
            color="primary"
            radius="full"
            size="md"
          >
            <Tab
              key="kanban"
              title={
                <span className="flex items-center gap-1.5">
                  <KanbanSquare className="size-4" /> Kanban
                </span>
              }
            />
            <Tab
              key="lista"
              title={
                <span className="flex items-center gap-1.5">
                  <List className="size-4" /> Lista
                </span>
              }
            />
          </Tabs>
          <Button
            color="primary"
            radius="full"
            startContent={<Plus className="size-4" />}
            onPress={() => setDrawer({ mode: "create" })}
            className="font-semibold"
          >
            Novo lead
          </Button>
          <Button
            color="primary"
            variant="flat"
            radius="full"
            startContent={<ScanText className="size-4" />}
            onPress={() => setPrintOpen(true)}
            className="font-semibold"
          >
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
        <Card shadow="sm" className="border border-danger-200">
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-danger" />
            <div>
              <p className="font-semibold">Não foi possível carregar os leads</p>
              <p className="text-sm text-default-500">{describeDbError(leadsQuery.error)}</p>
            </div>
            <Button
              variant="flat"
              color="primary"
              startContent={<RefreshCw className="size-4" />}
              onPress={() => leadsQuery.refetch()}
              isLoading={leadsQuery.isFetching}
            >
              Tentar novamente
            </Button>
          </CardBody>
        </Card>
      ) : leadsQuery.isPending ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex w-[280px] shrink-0 flex-col gap-2.5 rounded-2xl bg-default-50 p-3 xl:flex-1"
            >
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ))}
        </div>
      ) : noLeadsAtAll ? (
        <Card shadow="sm" className="border border-default-100">
          <CardBody className="flex flex-col items-center gap-3 py-14 text-center">
            <Inbox className="size-10 text-pool-light" />
            <div>
              <p className="font-semibold">Nenhum lead ainda</p>
              <p className="text-sm text-default-500">
                Os pedidos do formulário do site aparecem aqui. Você também pode cadastrar
                manualmente.
              </p>
            </div>
            <Button
              color="primary"
              startContent={<Plus className="size-4" />}
              onPress={() => setDrawer({ mode: "create" })}
            >
              Cadastrar primeiro lead
            </Button>
          </CardBody>
        </Card>
      ) : view === "kanban" ? (
        <>
          {filtersActive && funnelLeads.length === 0 && (
            <Card shadow="none" className="border border-default-200">
              <CardBody className="p-0">{filteredEmpty}</CardBody>
            </Card>
          )}
          <LeadKanban leads={funnelLeads} onOpen={openLead} onMove={moveLead} />
        </>
      ) : (
        <LeadTable
          leads={listLeads}
          onOpen={openLead}
          resetKey={JSON.stringify(filters)}
          emptyContent={filteredEmpty}
        />
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
    </div>
  );
}
