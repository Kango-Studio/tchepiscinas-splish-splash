import { useMemo, useState } from "react";
import { Button, Card, CardBody } from "@heroui/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { describeDbError, useLeads } from "./leads-api";
import {
  EMPTY_FILTERS,
  applyLeadFilters,
  distinctCities,
  hasActiveFilters,
  type LeadFilters,
} from "./filters";
import { LeadFiltersBar } from "./LeadFiltersBar";
import { LeadDashboard } from "./LeadDashboard";
import { useAllFollowups } from "./followups-api";
import { FollowupSummaryCard, FollowupsByStageCard } from "./FollowupReport";

export function DashboardPage() {
  const leadsQuery = useLeads();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);

  const allLeads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const cities = useMemo(() => distinctCities(allLeads), [allLeads]);
  // O funil já separa por etapa, então o filtro de etapa não se aplica aqui.
  const leads = useMemo(
    () => applyLeadFilters(allLeads, filters, { includeStage: false }),
    [allLeads, filters],
  );

  const followupsQuery = useAllFollowups();
  // Follow-ups seguem os mesmos filtros dos leads.
  const followups = useMemo(() => {
    const ids = new Set(leads.map((l) => l.id));
    return (followupsQuery.data ?? []).filter((f) => ids.has(f.lead_id));
  }, [followupsQuery.data, leads]);
  const followupsLoading = leadsQuery.isPending || followupsQuery.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-pool-deep md:text-3xl">Dashboard</h1>
        <p className="text-sm text-default-500">Funil de vendas, origem dos leads e follow-ups.</p>
      </div>

      <LeadFiltersBar filters={filters} onChange={setFilters} cities={cities} showStage={false} />

      {leadsQuery.isError ? (
        <Card shadow="sm" className="border border-danger-200">
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-danger" />
            <div>
              <p className="font-semibold">Não foi possível carregar os dados</p>
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
      ) : (
        <>
          <LeadDashboard
            leads={leads}
            isLoading={leadsQuery.isPending}
            filtered={hasActiveFilters(filters)}
          />
          {followupsQuery.isError ? (
            <p className="text-sm text-danger">
              Não foi possível carregar os follow-ups: {describeDbError(followupsQuery.error)}
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <FollowupSummaryCard followups={followups} isLoading={followupsLoading} />
              </div>
              <div className="min-w-0 lg:col-span-3">
                <FollowupsByStageCard
                  leads={leads}
                  followups={followups}
                  isLoading={followupsLoading}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
