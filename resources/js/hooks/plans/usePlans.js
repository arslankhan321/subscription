import { useCallback, useEffect, useState } from "react";
import { getPlans } from "@/Services/planService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function usePlans() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPlans = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getPlans();
            const payload = response.data?.data;
            const items = Array.isArray(payload)
                ? payload
                : payload?.data ?? [];
            setPlans(items);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Unable to load plans");
            setError(message);
            showToast(message, { isError: true });
        } finally {
            setLoading(false);
        }
    }, []);

    const removePlanFromList = useCallback((id) => {
        setPlans((prev) => prev.filter((plan) => plan.id !== id));
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    return {
        plans,
        loading,
        error,
        refetch: fetchPlans,
        removePlanFromList,
    };
}
