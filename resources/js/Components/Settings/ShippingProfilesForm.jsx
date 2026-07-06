import { useCallback } from "react";
import { useAssignShippingPlansModal } from "@/Components/Settings/AssignShippingPlansModal";
import { useCreateShippingProfileModal } from "@/Components/Settings/CreateShippingProfileModal";
import { useDeleteShippingProfileModal } from "@/Components/Settings/DeleteShippingProfileModal";
import { useShippingProfiles } from "@/hooks/settings/useShippingProfiles";
import { getShopifyShippingSettingsUrl } from "@/Services/shippingProfileService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

function openExternalUrl(url) {
    if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}

function getShopifyAdminUrl(path) {
    const shop = window.shopify?.config?.shop;

    if (!shop) {
        return null;
    }

    return `https://${shop}/admin${path}`;
}

export default function ShippingProfilesForm() {
    const {
        profiles,
        loading,
        creating,
        deletingId,
        assigningId,
        createProfile,
        removeProfile,
        assignPlans,
    } = useShippingProfiles();

    const handleCreateProfile = useCallback(
        async (name) => {
            await createProfile(name);
        },
        [createProfile]
    );

    const { openCreateModal, createProfileModal } = useCreateShippingProfileModal({
        onCreate: handleCreateProfile,
    });

    const { openDeleteModal, deleteProfileModal } = useDeleteShippingProfileModal({
        onDelete: removeProfile,
    });

    const { openAssignPlansModal, assignPlansModal } = useAssignShippingPlansModal({
        onSave: assignPlans,
    });

    const openShopifyShippingSettings = useCallback(async () => {
        const directUrl = getShopifyAdminUrl("/settings/shipping");

        if (directUrl) {
            openExternalUrl(directUrl);
            return;
        }

        try {
            const response = await getShopifyShippingSettingsUrl();
            openExternalUrl(response.data?.data?.url);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to open Shopify shipping settings"), {
                isError: true,
            });
        }
    }, []);

    const handleEditProfile = useCallback((profile) => {
        openExternalUrl(profile.shopifyEditUrl ?? getShopifyAdminUrl("/settings/shipping"));
    }, []);

    return (
        <div className="shipping-profiles">
            <div className="shipping-profiles__intro">
                <p className="shipping-profiles__description">
                    Create profiles, configure rates in Shopify, then assign subscription plans here.
                </p>
                <div className="shipping-profiles__actions">
                    <s-button variant="secondary" onClick={openShopifyShippingSettings}>
                        Shopify Shipping Settings
                    </s-button>
                    <s-button variant="primary" loading={creating} onClick={openCreateModal}>
                        Create shipping profile
                    </s-button>
                </div>
            </div>

            <div className="shipping-profiles__getting-started">
                <h3 className="shipping-profiles__getting-started-title">Getting started</h3>
                <p className="shipping-profiles__getting-started-lead">
                    Only shipping profiles created through Force Subscriptions appear on this page.
                    Profiles created directly in Shopify are not listed here.
                </p>
                <ol className="shipping-profiles__steps">
                    <li>Create a shipping profile using the button above.</li>
                    <li>
                        Click Edit to configure zones and rates in Shopify. Do not add products
                        directly to the profile — only subscription plans should be assigned.
                    </li>
                    <li>Return here and click Select plan to link plans to the profile.</li>
                </ol>
                <p className="shipping-profiles__warning">
                    Only subscription plans should be attached to these profiles — never add
                    products directly in Shopify.
                </p>
            </div>

            {loading ? (
                <s-text tone="subdued">Loading shipping profiles...</s-text>
            ) : profiles.length === 0 ? (
                <div className="shipping-profiles__empty">
                    <div className="shipping-profiles__empty-icon" aria-hidden="true">
                        🧾
                    </div>
                    <h3 className="shipping-profiles__empty-title">No shipping profiles yet</h3>
                    <p className="shipping-profiles__empty-text">
                        Create your first shipping profile, then assign subscription plans to it.
                    </p>
                    <s-button variant="primary" loading={creating} onClick={openCreateModal}>
                        Create shipping profile
                    </s-button>
                </div>
            ) : (
                <div className="shipping-profiles__table-wrap">
                    <table className="shipping-profiles__table">
                        <thead>
                            <tr>
                                <th scope="col">Profile name</th>
                                <th scope="col">Subscription plans</th>
                                <th scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profiles.map((profile) => (
                                <tr key={profile.id}>
                                    <td>{profile.name}</td>
                                    <td>
                                        <s-button
                                            variant="secondary"
                                            loading={assigningId === profile.id}
                                            onClick={() => openAssignPlansModal(profile)}
                                        >
                                            {profile.assignedPlansCount > 0
                                                ? `Select plan (${profile.assignedPlansCount})`
                                                : "Select plan"}
                                        </s-button>
                                    </td>
                                    <td>
                                        <div className="shipping-profiles__row-actions">
                                            <s-button
                                                icon="edit"
                                                variant="tertiary"
                                                accessibilityLabel={`Edit ${profile.name}`}
                                                onClick={() => handleEditProfile(profile)}
                                            />
                                            <s-button
                                                icon="delete"
                                                variant="tertiary"
                                                tone="critical"
                                                accessibilityLabel={`Delete ${profile.name}`}
                                                loading={deletingId === profile.id}
                                                onClick={() => openDeleteModal(profile)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {createProfileModal}
            {deleteProfileModal}
            {assignPlansModal}
        </div>
    );
}
