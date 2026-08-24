import { useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn, titleCase } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import { DataGrid, type DataGridColumn } from "@/components/shared/DataGrid";
import { ExportCsvButton } from "@/components/shared/ExportCsvButton";
import { VolunteerBatchBadge } from "@/components/shared/VolunteerBatchBadge";
import { useCreatePlan, usePlans, useUpdatePlan } from "@/hooks/usePlans";
import { useAuthStore } from "@/stores/auth";
import { PLAN_TIER_ORDER, Role, type PlanResponse, type PlanTier, type PlanValidityType } from "@nmms/shared";

const CAN_MANAGE = [Role.SUPER_ADMIN, Role.ADMIN];

function formatFee(fee: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    fee,
  );
}

function formatValidity(plan: PlanResponse) {
  return plan.validityType === "LIFETIME" ? "Lifetime" : `${plan.validityMonths} months`;
}

export function MembershipPlans() {
  const [editing, setEditing] = useState<PlanResponse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const canManage = !!user && CAN_MANAGE.includes(user.role);
  const { data: plans = [], isLoading, isError } = usePlans();
  const updatePlan = useUpdatePlan();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(plan: PlanResponse) {
    setEditing(plan);
    setSheetOpen(true);
  }

  const columns: DataGridColumn<PlanResponse>[] = useMemo(
    () => [
      { key: "name", header: "Plan", sortable: true, cellClass: "font-medium" },
      {
        key: "tier",
        header: "Tier",
        sortable: true,
        render: (plan) =>
          plan.tier ? (
            <Badge variant="outline">{plan.tier.charAt(0) + plan.tier.slice(1).toLowerCase()}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { key: "volunteerBatch", header: "Volunteer Batch", render: (plan) => <VolunteerBatchBadge batch={plan.tier} /> },
      {
        key: "fee",
        header: "Fee",
        sortable: true,
        render: (plan) => <span className="text-muted-foreground">{formatFee(plan.fee)}</span>,
      },
      {
        key: "validityType",
        header: "Validity",
        render: (plan) => <span className="text-muted-foreground">{formatValidity(plan)}</span>,
      },
      {
        key: "isActive",
        header: "Status",
        sortable: true,
        render: (plan) => (
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              plan.isActive
                ? "border-transparent bg-brand-green/10 text-brand-green"
                : "border-transparent bg-muted text-muted-foreground",
            )}
          >
            {plan.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  const exportRows = useMemo(
    () =>
      plans.map((plan) => ({
        name: plan.name,
        tier: plan.tier ?? "",
        fee: plan.fee,
        validity: formatValidity(plan),
        status: plan.isActive ? "Active" : "Inactive",
      })),
    [plans],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">Membership Plans</h1>
          <p className="text-sm text-muted-foreground">{plans.length} plans configured</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton filename="membership-plans.csv" rows={exportRows} />
          {canManage && (
            <Button className="bg-brand-green hover:bg-brand-green/90" onClick={openCreate}>
              <Plus />
              Add Plan
            </Button>
          )}
        </div>
      </div>

      <DataGrid
        columns={columns}
        data={plans}
        isLoading={isLoading}
        isError={isError}
        errorMessage="Failed to load plans."
        emptyMessage="No membership plans yet."
        rowKey={(plan) => plan.id}
        searchable={false}
        pageSize={25}
        quickActions={
          canManage
            ? (plan) => (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatePlan.isPending}
                    onClick={() => updatePlan.mutate({ id: plan.id, dto: { isActive: !plan.isActive } })}
                  >
                    {plan.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              )
            : undefined
        }
      />

      <PlanSheet
        key={editing?.id ?? "new"}
        plan={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

function PlanSheet({
  plan,
  open,
  onOpenChange,
}: {
  plan: PlanResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = plan !== null;
  const [name, setName] = useState(plan?.name ?? "");
  const [tier, setTier] = useState<PlanTier | "">(plan?.tier ?? "");
  const [fee, setFee] = useState(plan ? String(plan.fee) : "");
  const [validityType, setValidityType] = useState<PlanValidityType>(plan?.validityType ?? "MONTHS");
  const [validityMonths, setValidityMonths] = useState(
    plan?.validityMonths ? String(plan.validityMonths) : "12",
  );
  const [error, setError] = useState<string | null>(null);

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const isPending = createPlan.isPending || updatePlan.isPending;

  function reset() {
    setName(plan?.name ?? "");
    setTier(plan?.tier ?? "");
    setFee(plan ? String(plan.fee) : "");
    setValidityType(plan?.validityType ?? "MONTHS");
    setValidityMonths(plan?.validityMonths ? String(plan.validityMonths) : "12");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEdit) {
        await updatePlan.mutateAsync({
          id: plan.id,
          dto: {
            name,
            tier: tier || null,
            fee: Number(fee),
            validityType,
            validityMonths: validityType === "MONTHS" ? Number(validityMonths) : null,
          },
        });
      } else {
        await createPlan.mutateAsync({
          name,
          tier: tier || null,
          fee: Number(fee),
          validityType,
          validityMonths: validityType === "MONTHS" ? Number(validityMonths) : undefined,
        });
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Plan" : "Add Plan"}</SheetTitle>
          <SheetDescription>
            {isEdit ? `Editing ${plan.name}.` : "Create a new membership plan."}
          </SheetDescription>
        </SheetHeader>
        <form className="flex flex-1 flex-col gap-4 px-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Plan name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier">Tier</Label>
            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value as PlanTier | "")}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">None</option>
              {PLAN_TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Drives per-tier reward points, referral point rules, and the member's volunteer batch. Leave as
              None for a custom plan.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee">Fee (₹)</Label>
            <Input
              id="fee"
              type="number"
              min="0"
              step="1"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="validityType">Validity</Label>
            <select
              id="validityType"
              value={validityType}
              onChange={(e) => setValidityType(e.target.value as PlanValidityType)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="MONTHS">Fixed duration</option>
              <option value="LIFETIME">Lifetime</option>
            </select>
          </div>
          {validityType === "MONTHS" && (
            <div className="space-y-1.5">
              <Label htmlFor="validityMonths">Duration (months)</Label>
              <Input
                id="validityMonths"
                type="number"
                min="1"
                step="1"
                value={validityMonths}
                onChange={(e) => setValidityMonths(e.target.value)}
                required
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending} className="bg-brand-green hover:bg-brand-green/90">
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Plan"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
