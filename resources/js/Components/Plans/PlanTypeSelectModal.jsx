import { useRef, useCallback } from "react";
import { PLAN_TYPES } from "@/constants/planConstants";

const MODAL_ID = "plan-type-modal";

export function usePlanTypeModal({ onSelect }) {
    const modalRef = useRef(null);

    const openPlanTypeModal = useCallback(() => {
        modalRef.current?.showOverlay?.();
    }, []);

    const closePlanTypeModal = useCallback(() => {
        modalRef.current?.hideOverlay?.();
    }, []);

    const handleSelect = useCallback(
        (planType) => {
            onSelect?.(planType);
            closePlanTypeModal();
        },
        [onSelect, closePlanTypeModal]
    );

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Select the subscription rule type"
            accessibilityLabel="Choose subscription plan type"
            size="large"
        >
            <s-stack direction="block" gap="base">
                <PlanTypeCard
                    title="Auto-charging subscription rule"
                    badge="Most popular choice!"
                    badgeTone="success"
                    description="Automatically charges subscribers using Shopify Payments, Shop Pay, Stripe, PayPal Express, and other supported gateways. Syncs with Shopify selling plans."
                    onSelect={() => handleSelect(PLAN_TYPES.AUTO_CHARGE)}
                />

                <PlanTypeCard
                    title="Recurring invoices"
                    description="Classic subscription rule that does not auto-charge customers. Works with other payment gateways. Saved locally in the app — not linked to Shopify."
                    onSelect={() => handleSelect(PLAN_TYPES.RECURRING_INVOICE)}
                />
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                onClick={closePlanTypeModal}
            >
                Close
            </s-button>
        </s-modal>
    );

    return { openPlanTypeModal, planTypeModal: modal };
}

function PlanTypeCard({ title, badge, badgeTone, description, onSelect }) {
    return (
        <button type="button" className="plan-type-card" onClick={onSelect}>
            <div className="plan-type-card__content">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text type="strong">{title}</s-text>
                    {badge && <s-badge tone={badgeTone}>{badge}</s-badge>}
                </s-stack>
                <s-text tone="subdued">{description}</s-text>
            </div>
            <span className="plan-type-card__arrow" aria-hidden="true">
                ›
            </span>
        </button>
    );
}
