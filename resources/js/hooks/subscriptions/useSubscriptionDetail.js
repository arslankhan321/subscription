import { useCallback, useEffect, useState } from "react";
import { getSubscription } from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useSubscriptionDetail(id) {
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSubscription = useCallback(async () => {
        if (!id) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await getSubscription(id);
            setSubscription(response.data?.data ?? null);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Unable to load subscription");
            setError(message);
            showToast(message, { isError: true });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    return {
        subscription,
        loading,
        error,
        refetch: fetchSubscription,
    };
}
