import { useCallback, useEffect, useState } from "react";
import {
    assignShippingProfilePlans,
    createShippingProfile,
    deleteShippingProfile,
    getShippingProfiles,
} from "@/Services/shippingProfileService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useShippingProfiles() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [assigningId, setAssigningId] = useState(null);

    const fetchProfiles = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getShippingProfiles();
            setProfiles(response.data?.data ?? []);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load shipping profiles"), {
                isError: true,
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const createProfile = useCallback(
        async (name) => {
            try {
                setCreating(true);
                const response = await createShippingProfile({ name });
                const profile = response.data?.data;

                if (profile) {
                    setProfiles((current) => [profile, ...current]);
                }

                showToast(response.data?.message || "Shipping profile created");
                return profile;
            } catch (error) {
                showToast(getApiErrorMessage(error, "Unable to create shipping profile"), {
                    isError: true,
                });
                throw error;
            } finally {
                setCreating(false);
            }
        },
        []
    );

    const removeProfile = useCallback(async (profileId) => {
        try {
            setDeletingId(profileId);
            const response = await deleteShippingProfile(profileId);
            setProfiles((current) => current.filter((profile) => profile.id !== profileId));
            showToast(response.data?.message || "Shipping profile deleted");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to delete shipping profile"), {
                isError: true,
            });
            throw error;
        } finally {
            setDeletingId(null);
        }
    }, []);

    const assignPlans = useCallback(async (profileId, subscriptionPlanIds) => {
        try {
            setAssigningId(profileId);
            const response = await assignShippingProfilePlans(profileId, {
                subscriptionPlanIds,
            });
            const profile = response.data?.data;

            if (profile) {
                setProfiles((current) =>
                    current.map((item) => (item.id === profile.id ? profile : item))
                );
            }

            showToast(response.data?.message || "Plans assigned successfully");
            return profile;
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to assign plans"), { isError: true });
            throw error;
        } finally {
            setAssigningId(null);
        }
    }, []);

    return {
        profiles,
        loading,
        creating,
        deletingId,
        assigningId,
        refetch: fetchProfiles,
        createProfile,
        removeProfile,
        assignPlans,
    };
}
