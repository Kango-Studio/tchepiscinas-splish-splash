import { useState } from "react";
import { Button, Tabs } from "@heroui/react";
import { FileText, Plus, Pulse, Wallet } from "@gravity-ui/icons";
import type { Visit } from "@/lib/visits/schema";
import { useClientRows } from "./visits-ui";
import { DeleteVisitDialog, VisitModal, type VisitModalState } from "./VisitModal";
import { ContactModal, FrequencyTab, type ContactTarget } from "./FrequencyTab";
import { ReportsTab } from "./ReportsTab";
import { currentMonth } from "@/lib/visits/frequency";
import { ClosingTab } from "./ClosingTab";

export const VISIT_TABS = ["frequencia", "relatorios", "fechamento"] as const;
export type VisitTab = (typeof VISIT_TABS)[number];

// mes: "AAAA-MM" do fechamento.
export type VisitFilters = { aba?: VisitTab; mes?: string };

export function VisitsPage({
  filters,
  onFiltersChange,
}: {
  filters: VisitFilters;
  onFiltersChange: (filters: VisitFilters) => void;
}) {
  const data = useClientRows();
  const [modal, setModal] = useState<VisitModalState>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);
  const [contact, setContact] = useState<ContactTarget | null>(null);
  const tab = filters.aba ?? "frequencia";

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="animate-admin-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
              Visitas
            </h1>
            <p className="text-sm text-muted">
              Frequência dos clientes, relatórios e fechamento dos piscineiros.
            </p>
          </div>
          <Button size="lg" onPress={() => setModal({})}>
            <Plus className="size-4" />
            Registrar visita
          </Button>
        </div>

        <Tabs
          selectedKey={tab}
          onSelectionChange={(k) =>
            onFiltersChange({ ...filters, aba: k === "frequencia" ? undefined : (k as VisitTab) })
          }
          className="gap-5"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Seções de visitas">
              <Tabs.Tab id="frequencia" className="gap-1.5">
                <Pulse className="size-4 max-sm:hidden" />
                Frequência
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="relatorios" className="gap-1.5">
                <Tabs.Separator />
                <FileText className="size-4 max-sm:hidden" />
                Relatórios
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="fechamento" className="gap-1.5">
                <Tabs.Separator />
                <Wallet className="size-4 max-sm:hidden" />
                Fechamento
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="frequencia" className="animate-admin-rise">
            <FrequencyTab
              onRegisterVisit={(c) =>
                setModal({ clientId: c.id, techId: c.pool_tech_id ?? undefined })
              }
              onContact={setContact}
            />
          </Tabs.Panel>
          <Tabs.Panel id="relatorios" className="animate-admin-rise">
            <ReportsTab />
          </Tabs.Panel>
          <Tabs.Panel id="fechamento" className="animate-admin-rise">
            <ClosingTab
              month={filters.mes ?? currentMonth()}
              onMonthChange={(mes) =>
                onFiltersChange({ ...filters, mes: mes === currentMonth() ? undefined : mes })
              }
              onEdit={(visit) => setModal({ visit })}
              onDelete={setToDelete}
            />
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Pop-ups fora do Tabs: dentro dele o React Aria os duplicaria. */}
      <VisitModal state={modal} onClose={() => setModal(null)} />
      <DeleteVisitDialog
        visit={toDelete}
        clientName={toDelete ? data.rows.find((c) => c.id === toDelete.client_id)?.name : undefined}
        onClose={() => setToDelete(null)}
      />
      <ContactModal target={contact} onClose={() => setContact(null)} />
    </>
  );
}
