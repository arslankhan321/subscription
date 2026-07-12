import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModalListSkeleton } from "@/Components/Skeletons";
import { getPlans } from "@/Services/planService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/skeleton.css";

const MODAL_ID = "assign-shipping-plans-modal";

export function useAssignShippingPlansModal({ onSave }) {
    const modalRef = useRef(null);
    const [profile, setProfile] = useState(null);
    const [plans, setPlans] = useState([]);
    const [selectedPlanIds, setSelectedPlanIds] = useState([]);
    const [search, setSearch] = useState("");
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadPlans = useCallback(async () => {
        try {
            setLoadingPlans(true);
            const response = await getPlans();
            const payload = response.data?.data;
            const items = Array.isArray(payload) ? payload : payload?.data ?? [];
            setPlans(items);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load plans"), { isError: true });
        } finally {
            setLoadingPlans(false);
        }
    }, []);

    const openAssignPlansModal = useCallback(
        async (shippingProfile) => {
            setProfile(shippingProfile);
            setSelectedPlanIds(shippingProfile.subscriptionPlanIds ?? []);
            setSearch("");
            modalRef.current?.showOverlay?.();

            if (plans.length === 0) {
                await loadPlans();
            }
        },
        [loadPlans, plans.length]
    );

    const closeAssignPlansModal = useCallback(() => {
        modalRef.current?.hideOverlay?.();
        setProfile(null);
        setSearch("");
    }, []);

    const filteredPlans = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return plans;
        }

        return plans.filter((plan) => plan.name.toLowerCase().includes(query));
    }, [plans, search]);

    const togglePlan = useCallback((planId) => {
        setSelectedPlanIds((current) =>
            current.includes(planId)
                ? current.filter((id) => id !== planId)
                : [...current, planId]
        );
    }, []);

    const selectAllVisible = useCallback(() => {
        const visibleIds = filteredPlans.map((plan) => plan.id);
        setSelectedPlanIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }, [filteredPlans]);

    const clearSelection = useCallback(() => {
        setSelectedPlanIds([]);
    }, []);

    const confirmAssign = useCallback(async () => {
        if (!profile || saving) {
            return;
        }

        setSaving(true);

        try {
            await onSave?.(profile.id, selectedPlanIds);
            closeAssignPlansModal();
        } finally {
            setSaving(false);
        }
    }, [profile, saving, onSave, selectedPlanIds, closeAssignPlansModal]);

    useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading={profile ? `Assign plans to ${profile.name}` : "Assign plans"}
            accessibilityLabel="Assign subscription plans to shipping profile"
            size="large"
        >
            <s-stack direction="block" gap="base">
                <s-text tone="subdued">
                    Choose which subscription plans use this shipping profile. Checked plans will
                    be linked when you save.
                </s-text>

                <s-text-field
                    label="Filter plans"
                    value={search}
                    placeholder="Search by plan name"
                    icon="search"
                    onInput={(event) => setSearch(event.target.value)}
                />

                <div className="shipping-assign-modal__toolbar">
                    <s-text tone="subdued">
                        {selectedPlanIds.length} of {plans.length} selected
                    </s-text>
                    <div className="shipping-assign-modal__toolbar-actions">
                        <s-button
                            variant="tertiary"
                            disabled={filteredPlans.length === 0}
                            onClick={selectAllVisible}
                        >
                            Select all
                        </s-button>
                        <s-button
                            variant="tertiary"
                            disabled={selectedPlanIds.length === 0}
                            onClick={clearSelection}
                        >
                            Clear selection
                        </s-button>
                    </div>
                </div>

                <div className="shipping-assign-modal__list">
                    {loadingPlans ? (
                        <ModalListSkeleton rows={4} />
                    ) : filteredPlans.length === 0 ? (
                        <s-text tone="subdued">No plans found.</s-text>
                    ) : (
                        filteredPlans.map((plan) => (
                            <label key={plan.id} className="shipping-assign-modal__item">
                                <s-checkbox
                                    checked={selectedPlanIds.includes(plan.id)}
                                    onChange={() => togglePlan(plan.id)}
                                />
                                <span>{plan.name}</span>
                            </label>
                        ))
                    )}
                </div>
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                disabled={saving}
                onClick={closeAssignPlansModal}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={saving}
                disabled={!profile}
                onClick={confirmAssign}
            >
                Save ({selectedPlanIds.length})
            </s-button>
        </s-modal>
    );

    return {
        openAssignPlansModal,
        assignPlansModal: modal,
    };
}
