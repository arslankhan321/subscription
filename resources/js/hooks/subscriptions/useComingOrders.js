import { useCallback, useEffect, useState } from "react";
import {
    getSubscriptionInvoices,
    requestSubscriptionInvoiceNow,
    rescheduleSubscriptionInvoice,
    resendSubscriptionInvoiceEmail,
} from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useComingOrders(
    subscriptionId,
    { enabled = true, onActionComplete = null } = {}
) {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
        if (!subscriptionId || !enabled) {
            setInvoices([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await getSubscriptionInvoices(subscriptionId);
            const data = response?.data?.data ?? response?.data ?? {};
            setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
        } catch (err) {
            console.error(err);
            setError(getApiErrorMessage(err, "Unable to load invoices"));
            setInvoices([]);
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

    const requestNow = useCallback(
        (invoiceId) =>
            runAction(
                `request-${invoiceId}`,
                () => requestSubscriptionInvoiceNow(subscriptionId, invoiceId),
                "Invoice sent"
            ),
        [runAction, subscriptionId]
    );

    const resendEmail = useCallback(
        (invoiceId) =>
            runAction(
                `resend-${invoiceId}`,
                () => resendSubscriptionInvoiceEmail(subscriptionId, invoiceId),
                "Invoice email resent"
            ),
        [runAction, subscriptionId]
    );

    const reschedule = useCallback(
        (invoiceId, targetDate) =>
            runAction(
                `reschedule-${invoiceId}`,
                () => rescheduleSubscriptionInvoice(subscriptionId, invoiceId, targetDate),
                "Invoice rescheduled"
            ),
        [runAction, subscriptionId]
    );

    return {
        invoices,
        loading,
        actionLoading,
        error,
        refetch,
        requestNow,
        resendEmail,
        reschedule,
    };
}
