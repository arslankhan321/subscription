import { useCallback, useRef, useState } from "react";
import { cancelSubscription } from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

const MODAL_ID = "cancel-subscription-modal";

export function useCancelSubscriptionModal({ onCancelled }) {
    const modalRef = useRef(null);
    const [subscription, setSubscription] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    const open = useCallback((nextSubscription) => {
        setSubscription(nextSubscription);
        modalRef.current?.showOverlay?.();
    }, []);

    const close = useCallback(() => {
        if (cancelling) {
            return;
        }

        modalRef.current?.hideOverlay?.();
        setSubscription(null);
    }, [cancelling]);

    const confirmCancel = useCallback(async () => {
        if (!subscription?.id || cancelling) {
            return;
        }

        setCancelling(true);

        try {
            const response = await cancelSubscription(subscription.id);
            showToast(response.data?.message || "Subscription cancelled");
            onCancelled?.(response.data?.data ?? null);
            modalRef.current?.hideOverlay?.();
            setSubscription(null);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to cancel subscription"), {
                isError: true,
            });
        } finally {
            setCancelling(false);
        }
    }, [subscription, cancelling, onCancelled]);

    const reference = subscription?.reference || "this subscription";

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Cancel subscription?"
            accessibilityLabel="Confirm subscription cancellation"
            size="small"
        >
            <s-stack direction="block" gap="base">
                <s-text>
                    This will cancel {reference}. Future billing and deliveries will stop.
                </s-text>
                <s-text tone="caution">This action cannot be undone.</s-text>
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                disabled={cancelling}
                onClick={close}
            >
                Keep subscription
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                tone="critical"
                loading={cancelling}
                disabled={!subscription?.id || cancelling}
                onClick={confirmCancel}
            >
                Cancel subscription
            </s-button>
        </s-modal>
    );

    return {
        open,
        modal,
        cancelling,
    };
}
