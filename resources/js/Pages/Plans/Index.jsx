import { useMemo, useState, useCallback } from "react";
import PlanForm from "./PlanForm";
import RecurringInvoicePlanForm from "./RecurringInvoicePlanForm";
import PlanStatCard from "@/Components/Plans/PlanStatCard";
import PlanEmptyState from "@/Components/Plans/PlanEmptyState";
import { useDeletePlanModal } from "@/Components/Plans/DeletePlanModal";
import { usePlanTypeModal } from "@/Components/Plans/PlanTypeSelectModal";
import { usePlans } from "@/hooks/plans/usePlans";
import { PLAN_TYPES } from "@/constants/planConstants";
import { formatPlanStatus, getPlanTypeLabel, getStatusTone } from "@/utils/planHelpers";
import "@/styles/plans.css";

export default function PlansListing() {
    const [view, setView] = useState({ mode: "listing", planId: null, planType: null });
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const { plans, loading, refetch, removePlanFromList } = usePlans();

    const handlePlanDeleted = useCallback(
        (planId) => {
            removePlanFromList(planId);
        },
        [removePlanFromList]
    );

    const { openDeleteModal, deleteModal } = useDeletePlanModal({
        onDeleted: handlePlanDeleted,
    });

    const handlePlanTypeSelect = useCallback((planType) => {
        setView({ mode: "form", planId: null, planType });
    }, []);

    const { openPlanTypeModal, planTypeModal } = usePlanTypeModal({
        onSelect: handlePlanTypeSelect,
    });

    const filteredPlans = useMemo(() => {
        return plans.filter((plan) => {
            const matchesSearch = plan.name
                .toLowerCase()
                .includes(search.toLowerCase());
            const matchesStatus =
                statusFilter === "all" || plan.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [plans, search, statusFilter]);

    const stats = useMemo(() => {
        return {
            total: plans.length,
            active: plans.filter((p) => p.status === "active").length,
            draft: plans.filter((p) => p.status === "draft").length,
            archived: plans.filter((p) => p.status === "archived").length,
        };
    }, [plans]);

    const goToListing = () => setView({ mode: "listing", planId: null, planType: null });
    const goToEdit = (plan) =>
        setView({
            mode: "form",
            planId: plan.id,
            planType: plan.plan_type || PLAN_TYPES.AUTO_CHARGE,
        });

    if (view.mode === "form") {
        if (view.planType === PLAN_TYPES.RECURRING_INVOICE) {
            return (
                <RecurringInvoicePlanForm
                    planId={view.planId}
                    onBack={goToListing}
                    onSaved={refetch}
                />
            );
        }

        return (
            <PlanForm
                planId={view.planId}
                onBack={goToListing}
                onSaved={refetch}
            />
        );
    }

    return (
        <div className="plans-page">
            <s-page heading="Subscription Plans">
                <s-button slot="primary-action" variant="primary" onClick={openPlanTypeModal}>
                    Create Plan
                </s-button>

                <s-stack direction="block" gap="base">
                    <div className="plans-hero">
                        <h2 className="plans-hero__title">Manage subscription plans</h2>
                        <p className="plans-hero__subtitle">
                            Create auto-charging plans synced to Shopify, or recurring invoice
                            rules saved locally in the app.
                        </p>
                    </div>

                    <div className="plans-stats">
                        <PlanStatCard value={stats.total} label="Total Plans" variant="total" />
                        <PlanStatCard value={stats.active} label="Active" variant="active" />
                        <PlanStatCard value={stats.draft} label="Drafts" variant="draft" />
                        <PlanStatCard value={stats.archived} label="Archived" variant="archived" />
                    </div>

                    <div className="plans-table-wrap">
                        <div className="plans-toolbar">
                            <s-search-field
                                label="Search plans"
                                labelAccessibilityVisibility="exclusive"
                                placeholder="Search by plan name..."
                                value={search}
                                onInput={(e) => setSearch(e.target.value)}
                            />

                            <s-select
                                label="Status"
                                labelAccessibilityVisibility="exclusive"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <s-option value="all">All Statuses</s-option>
                                <s-option value="active">Active</s-option>
                                <s-option value="draft">Draft</s-option>
                                <s-option value="archived">Archived</s-option>
                            </s-select>
                        </div>

                        <s-table loading={loading}>
                            <s-table-header-row>
                                <s-table-header listSlot="primary">Plan Name</s-table-header>
                                <s-table-header listSlot="inline">Type</s-table-header>
                                <s-table-header listSlot="inline">Widget</s-table-header>
                                <s-table-header listSlot="labeled">Products</s-table-header>
                                <s-table-header listSlot="inline">Options</s-table-header>
                                <s-table-header listSlot="inline">Status</s-table-header>
                                <s-table-header listSlot="inline">Shopify</s-table-header>
                                <s-table-header listSlot="secondary">Actions</s-table-header>
                            </s-table-header-row>

                            <s-table-body>
                                {!loading && filteredPlans.length === 0 && (
                                    <s-table-row>
                                        <s-table-cell colSpan="8">
                                            <PlanEmptyState onCreate={openPlanTypeModal} />
                                        </s-table-cell>
                                    </s-table-row>
                                )}

                                {filteredPlans.map((plan) => (
                                    <s-table-row key={plan.id}>
                                        <s-table-cell>
                                            <s-stack direction="block" gap="small-100">
                                                <s-text type="strong">{plan.name}</s-text>
                                                <s-text tone="subdued">
                                                    Updated {new Date(plan.updated_at).toLocaleDateString()}
                                                </s-text>
                                            </s-stack>
                                        </s-table-cell>

                                        <s-table-cell>
                                            <s-badge>
                                                {getPlanTypeLabel(plan.plan_type)}
                                            </s-badge>
                                        </s-table-cell>

                                        <s-table-cell>
                                            <s-badge>{plan.widget || "—"}</s-badge>
                                        </s-table-cell>

                                        <s-table-cell>
                                            <s-text>
                                                {plan.products?.length ?? 0} product
                                                {(plan.products?.length ?? 0) === 1 ? "" : "s"}
                                            </s-text>
                                        </s-table-cell>

                                        <s-table-cell>
                                            <s-text>
                                                {plan.options?.length ?? 0} option
                                                {(plan.options?.length ?? 0) === 1 ? "" : "s"}
                                            </s-text>
                                        </s-table-cell>

                                        <s-table-cell>
                                            <s-badge tone={getStatusTone(plan.status)}>
                                                {formatPlanStatus(plan.status)}
                                            </s-badge>
                                        </s-table-cell>

                                        <s-table-cell>
                                            {plan.plan_type === PLAN_TYPES.RECURRING_INVOICE ? (
                                                <s-badge tone="subdued">Local only</s-badge>
                                            ) : plan.shopify_group_id ? (
                                                <s-badge tone="success">Synced</s-badge>
                                            ) : (
                                                <s-badge tone="subdued">Not synced</s-badge>
                                            )}
                                        </s-table-cell>

                                        <s-table-cell>
                                            <div className="plans-row-actions">
                                                <s-button
                                                    icon="edit"
                                                    onClick={() => goToEdit(plan)}
                                                >
                                                    Edit
                                                </s-button>
                                                <s-button
                                                    tone="critical"
                                                    icon="delete"
                                                    onClick={() => openDeleteModal(plan)}
                                                >
                                                    Delete
                                                </s-button>
                                            </div>
                                        </s-table-cell>
                                    </s-table-row>
                                ))}
                            </s-table-body>
                        </s-table>
                    </div>
                </s-stack>

                {deleteModal}
                {planTypeModal}
            </s-page>
        </div>
    );
}
