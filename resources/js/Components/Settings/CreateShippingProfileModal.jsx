import { useCallback, useRef, useState } from "react";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

const MODAL_ID = "create-shipping-profile-modal";

export function useCreateShippingProfileModal({ onCreate }) {
    const modalRef = useRef(null);
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);

    const openCreateModal = useCallback(() => {
        setName("");
        modalRef.current?.showOverlay?.();
    }, []);

    const closeCreateModal = useCallback(() => {
        modalRef.current?.hideOverlay?.();
        setName("");
    }, []);

    const confirmCreate = useCallback(async () => {
        const trimmedName = name.trim();

        if (!trimmedName || creating) {
            if (!trimmedName) {
                showToast("Profile name is required", { isError: true });
            }
            return;
        }

        setCreating(true);

        try {
            await onCreate?.(trimmedName);
            closeCreateModal();
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to create shipping profile"), {
                isError: true,
            });
        } finally {
            setCreating(false);
        }
    }, [name, creating, onCreate, closeCreateModal]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Create shipping profile"
            accessibilityLabel="Create shipping profile"
            size="small"
        >
            <s-text-field
                label="Profile name"
                value={name}
                placeholder="Subscription Shipping"
                details="A descriptive name for this shipping profile (e.g., 'Subscription Shipping')"
                onInput={(event) => setName(event.target.value)}
            />

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                disabled={creating}
                onClick={closeCreateModal}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={creating}
                onClick={confirmCreate}
            >
                Create profile
            </s-button>
        </s-modal>
    );

    return {
        openCreateModal,
        createProfileModal: modal,
    };
}
