import { useCallback, useRef, useState } from "react";

const MODAL_ID = "delete-shipping-profile-modal";

export function useDeleteShippingProfileModal({ onDelete }) {
    const modalRef = useRef(null);
    const [profile, setProfile] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const openDeleteModal = useCallback((shippingProfile) => {
        setProfile(shippingProfile);
        modalRef.current?.showOverlay?.();
    }, []);

    const closeDeleteModal = useCallback(() => {
        modalRef.current?.hideOverlay?.();
        setProfile(null);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!profile || deleting) {
            return;
        }

        setDeleting(true);

        try {
            await onDelete?.(profile.id);
            closeDeleteModal();
        } finally {
            setDeleting(false);
        }
    }, [profile, deleting, onDelete, closeDeleteModal]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Delete shipping profile?"
            accessibilityLabel="Confirm shipping profile deletion"
            size="small"
        >
            {profile && (
                <s-stack direction="block" gap="base">
                    <s-text>
                        This will permanently delete &quot;{profile.name}&quot; from Force
                        Subscriptions and remove it from Shopify.
                    </s-text>
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
                disabled={!profile}
                onClick={confirmDelete}
            >
                Delete profile
            </s-button>
        </s-modal>
    );

    return {
        openDeleteModal,
        deleteProfileModal: modal,
    };
}
