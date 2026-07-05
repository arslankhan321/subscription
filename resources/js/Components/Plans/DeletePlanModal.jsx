import { useRef, useState, useCallback } from "react";
import { deletePlan } from "@/Services/planService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

const MODAL_ID = "delete-plan-modal";

export function useDeletePlanModal({ onDeleted }) {
    const modalRef = useRef(null);
    const [planToDelete, setPlanToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const openDeleteModal = useCallback((plan) => {
        setPlanToDelete(plan);
        modalRef.current?.showOverlay?.();
    }, []);

    const closeDeleteModal = useCallback(() => {
        modalRef.current?.hideOverlay?.();
        setPlanToDelete(null);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!planToDelete || deleting) {
            return;
        }

        setDeleting(true);

        try {
            const response = await deletePlan(planToDelete.id);
            showToast(response.data.message || "Plan deleted successfully");
            onDeleted?.(planToDelete.id);
            closeDeleteModal();
        } catch (error) {
            console.error(error);
            showToast(getApiErrorMessage(error, "Unable to delete plan"), {
                isError: true,
            });
        } finally {
            setDeleting(false);
        }
    }, [planToDelete, deleting, onDeleted, closeDeleteModal]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Delete plan?"
            accessibilityLabel="Confirm plan deletion"
            size="small"
        >
            {planToDelete && (
                <s-stack direction="block" gap="base">
                    <s-text>
                        This will permanently delete &quot;{planToDelete.name}&quot;.
                    </s-text>

                    {planToDelete.shopify_group_id && (
                        <s-text tone="caution">
                            This plan is synced to Shopify. The selling plan group will
                            also be removed from your store.
                        </s-text>
                    )}

                    <s-text tone="caution">This action cannot be undone.</s-text>
                </s-stack>
            )}

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                disabled={deleting}
                onClick={closeDeleteModal}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                tone="critical"
                loading={deleting}
                disabled={!planToDelete}
                onClick={confirmDelete}
            >
                Delete plan
            </s-button>
        </s-modal>
    );

    return {
        openDeleteModal,
        deleteModal: modal,
    };
}

export default function DeletePlanModal(props) {
    const { deleteModal } = useDeletePlanModal(props);
    return deleteModal;
}
