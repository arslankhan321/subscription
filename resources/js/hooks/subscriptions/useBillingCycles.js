import { useCallback, useEffect, useMemo, useState } from "react";
import {
    chargeSubscriptionCycle,
    getSubscriptionBillingCycles,
    rescheduleSubscriptionCycle,
    skipSubscriptionCycle,
    unskipSubscriptionCycle,
} from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

const DEFAULT_PER_PAGE = 10;

function isUnbilledCycle(cycle) {
    const status = String(cycle?.status || "").toUpperCase();
    return !cycle?.skipped && status !== "BILLED" && !cycle?.billing_attempt?.order_name;
}

export function useBillingCycles(
    subscriptionId,
    { enabled = true, perPage = DEFAULT_PER_PAGE, onActionComplete = null } = {}
) {
    const [cycles, setCycles] = useState([]);
    const [pageInfo, setPageInfo] = useState({
        has_next_page: false,
        has_previous_page: false,
        end_cursor: null,
        page: 1,
        per_page: perPage,
    });
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    const fetchPage = useCallback(
        async ({ page = 1, after = null, append = false } = {}) => {
            if (!subscriptionId || !enabled) {
                return;
            }

            try {
                if (append) {
                    setLoadingMore(true);
                } else {
                    setLoading(true);
                }

                setError(null);

                const response = await getSubscriptionBillingCycles(subscriptionId, {
                    page,
                    per_page: perPage,
                    ...(after ? { after } : {}),
                });

                const payload = response.data?.data ?? {};
                const nextCycles = payload.cycles ?? [];
                const nextPageInfo = payload.page_info ?? {};

                setCycles((prev) => (append ? [...prev, ...nextCycles] : nextCycles));
                setPageInfo({
                    has_next_page: Boolean(nextPageInfo.has_next_page),
                    has_previous_page: Boolean(nextPageInfo.has_previous_page),
                    end_cursor: nextPageInfo.end_cursor ?? null,
                    page: nextPageInfo.page ?? page,
                    per_page: nextPageInfo.per_page ?? perPage,
                });
            } catch (err) {
                console.error(err);
                const message = getApiErrorMessage(err, "Unable to load billing schedule");
                setError(message);

                if (!append) {
                    setCycles([]);
                    showToast(message, { isError: true });
                }
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        },
        [subscriptionId, enabled, perPage]
    );

    useEffect(() => {
        setCycles([]);
        setPageInfo((prev) => ({
            ...prev,
            has_next_page: false,
            has_previous_page: false,
            end_cursor: null,
            page: 1,
            per_page: perPage,
        }));

        if (enabled && subscriptionId) {
            fetchPage({ page: 1 });
        }
    }, [subscriptionId, enabled, perPage, fetchPage]);

    const loadMore = useCallback(() => {
        if (!pageInfo.has_next_page || loadingMore || loading) {
            return;
        }

        fetchPage({
            page: (pageInfo.page || 1) + 1,
            after: pageInfo.end_cursor,
            append: true,
        });
    }, [fetchPage, pageInfo.has_next_page, pageInfo.page, pageInfo.end_cursor, loadingMore, loading]);

    const refetch = useCallback(() => fetchPage({ page: 1 }), [fetchPage]);

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

    const chargeCycle = useCallback(
        (cycleIndex) =>
            runAction(
                `charge-${cycleIndex}`,
                () => chargeSubscriptionCycle(subscriptionId, cycleIndex),
                "Charge attempt started"
            ),
        [runAction, subscriptionId]
    );

    const skipCycle = useCallback(
        (cycleIndex) =>
            runAction(
                `skip-${cycleIndex}`,
                () => skipSubscriptionCycle(subscriptionId, cycleIndex),
                "Billing cycle skipped"
            ),
        [runAction, subscriptionId]
    );

    const unskipCycle = useCallback(
        (cycleIndex) =>
            runAction(
                `unskip-${cycleIndex}`,
                () => unskipSubscriptionCycle(subscriptionId, cycleIndex),
                "Billing cycle unskipped"
            ),
        [runAction, subscriptionId]
    );

    const rescheduleCycle = useCallback(
        (cycleIndex, billingDate) =>
            runAction(
                `reschedule-${cycleIndex}`,
                () => rescheduleSubscriptionCycle(subscriptionId, cycleIndex, billingDate),
                "Billing cycle rescheduled"
            ),
        [runAction, subscriptionId]
    );

    const firstUnbilledIndex = useMemo(() => {
        const first = cycles.find(isUnbilledCycle);
        return first?.cycle_index ?? null;
    }, [cycles]);

    return {
        cycles,
        pageInfo,
        loading,
        loadingMore,
        actionLoading,
        error,
        firstUnbilledIndex,
        loadMore,
        refetch,
        chargeCycle,
        skipCycle,
        unskipCycle,
        rescheduleCycle,
    };
}
