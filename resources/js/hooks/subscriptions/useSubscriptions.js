import { useCallback, useEffect, useState } from "react";
import { getSubscriptions } from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useSubscriptions(filters = {}) {
    const [subscriptions, setSubscriptions] = useState([]);
    const [stats, setStats] = useState({
        all: 0,
        active: 0,
        paused: 0,
        cancelled: 0,
        failed: 0,
        upcoming: 0,
        pending_payment: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSubscriptions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getSubscriptions(filters);
            const payload = response.data?.data ?? {};

            setSubscriptions(payload.subscriptions ?? []);
            setStats(payload.stats ?? {});
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Unable to load subscriptions");
            setError(message);
            showToast(message, { isError: true });
        } finally {
            setLoading(false);
        }
    }, [filters.search, filters.status]);

    useEffect(() => {
        fetchSubscriptions();
    }, [fetchSubscriptions]);

    return {
        subscriptions,
        stats,
        loading,
        error,
        refetch: fetchSubscriptions,
    };
}
