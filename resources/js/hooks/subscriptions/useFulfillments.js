import { useCallback, useEffect, useState } from "react";
import {
    getSubscriptionFulfillments,
    refundSubscriptionFulfillment,
    rescheduleSubscriptionFulfillment,
    skipSubscriptionFulfillment,
} from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

const EMPTY_SUMMARY = {
    total: 0,
    fulfilled: 0,
    pending: 0,
    next_fulfillment: null,
    progress: 0,
};

export function useFulfillments(
    subscriptionId,
    { enabled = true, onActionComplete = null } = {}
) {
    const [summary, setSummary] = useState(EMPTY_SUMMARY);
    const [fulfillments, setFulfillments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
        if (!subscriptionId || !enabled) {
            setSummary(EMPTY_SUMMARY);
            setFulfillments([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await getSubscriptionFulfillments(subscriptionId);
            const data = response?.data?.data ?? response?.data ?? {};

            setSummary(data.summary ?? EMPTY_SUMMARY);
            setFulfillments(Array.isArray(data.fulfillments) ? data.fulfillments : []);
        } catch (err) {
            console.error(err);
            setError(getApiErrorMessage(err, "Unable to load fulfillments"));
            setSummary(EMPTY_SUMMARY);
            setFulfillments([]);
        } finally {
            setLoading(false);
        }
    }, [subscriptionId, enabled]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const runAction = useCallback(
        async (key, action, successMessage) => {
            if (!subscriptionId) {
                return;
            }

            try {
                setActionLoading(key);
                await action();
                showToast(successMessage);
                await refetch();
                onActionComplete?.();
            } catch (err) {
                console.error(err);
                showToast(getApiErrorMessage(err, "Action failed"), { isError: true });
            } finally {
                setActionLoading(null);
            }
        },
        [subscriptionId, refetch, onActionComplete]
    );

    const rescheduleFulfillment = useCallback(
        (fulfillmentOrderId, fulfillAt) =>
            runAction(
                `reschedule-${fulfillmentOrderId}`,
                () =>
                    rescheduleSubscriptionFulfillment(
                        subscriptionId,
                        fulfillmentOrderId,
                        fulfillAt
                    ),
                "Fulfillment rescheduled"
            ),
        [runAction, subscriptionId]
    );

    const skipFulfillment = useCallback(
        (fulfillmentOrderId) =>
            runAction(
                `skip-${fulfillmentOrderId}`,
                () => skipSubscriptionFulfillment(subscriptionId, fulfillmentOrderId),
                "Fulfillment skipped"
            ),
        [runAction, subscriptionId]
    );

    const refundFulfillment = useCallback(
        (fulfillmentOrderId) =>
            runAction(
                `refund-${fulfillmentOrderId}`,
                () => refundSubscriptionFulfillment(subscriptionId, fulfillmentOrderId),
                "Fulfillment refunded"
            ),
        [runAction, subscriptionId]
    );

    return {
        summary,
        fulfillments,
        loading,
        actionLoading,
        error,
        refetch,
        rescheduleFulfillment,
        skipFulfillment,
        refundFulfillment,
    };
}
