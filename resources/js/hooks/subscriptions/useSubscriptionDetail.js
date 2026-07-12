import { useCallback, useEffect, useState } from "react";
import { getSubscription } from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useSubscriptionDetail(id) {
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSubscription = useCallback(async (options = {}) => {
        if (!id) {
            return;
        }

        const silent = Boolean(options.silent);

        try {
            if (!silent) {
                setLoading(true);
            }
            setError(null);

            const response = await getSubscription(id);
            setSubscription(response.data?.data ?? null);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Unable to load subscription");
            setError(message);
            showToast(message, { isError: true });
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [id]);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    const setDiscounts = useCallback((discounts) => {
        setSubscription((prev) => (prev ? { ...prev, discounts } : prev));
    }, []);

    const setPaymentMethod = useCallback((paymentMethod) => {
        setSubscription((prev) => (prev ? { ...prev, payment_method: paymentMethod } : prev));
    }, []);

    const setShipping = useCallback((shipping) => {
        setSubscription((prev) => (prev ? { ...prev, shipping } : prev));
    }, []);

    const setCustomer = useCallback((customer) => {
        setSubscription((prev) => (prev ? { ...prev, customer } : prev));
    }, []);

    const setSubscriptionData = useCallback((data) => {
        setSubscription(data);
    }, []);

    return {
        subscription,
        loading,
        error,
        refetch: fetchSubscription,
        setSubscriptionData,
        setDiscounts,
        setPaymentMethod,
        setShipping,
        setCustomer,
    };
}
