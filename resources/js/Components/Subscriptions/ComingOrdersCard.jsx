import { useState } from "react";
import { formatDateTime } from "@/utils/subscriptionHelpers";
import { SkeletonBlock, SkeletonLine } from "@/Components/Skeletons";

function toDateTimeLocalValue(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const pad = (n) => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
}

function statusLabel(status) {
    const value = String(status || "").toLowerCase();
    if (value === "pending") {
        return "Pending";
    }
    if (value === "paid") {
        return "Paid";
    }
    if (value === "failed") {
        return "Failed";
    }
    return "Upcoming";
}

function statusTone(status) {
    const value = String(status || "").toLowerCase();
    if (value === "paid") {
        return "success";
    }
    if (value === "failed") {
        return "critical";
    }
    return "info";
}

export function ComingOrdersCard({
    invoices,
    loading,
    actionLoading,
    error,
    actionsDisabled,
    onRequestNow,
    onResendEmail,
    onReschedule,
}) {
    const [rescheduleId, setRescheduleId] = useState(null);
    const [rescheduleValue, setRescheduleValue] = useState("");

    const openReschedule = (invoice) => {
        setRescheduleId(invoice.id);
        setRescheduleValue(toDateTimeLocalValue(invoice.scheduled_at));
    };

    const cancelReschedule = () => {
        setRescheduleId(null);
        setRescheduleValue("");
    };

    const submitReschedule = async (invoiceId) => {
        if (!rescheduleValue) {
            return;
        }

        await onReschedule(invoiceId, new Date(rescheduleValue).toISOString());
        cancelReschedule();
    };

    return (
        <div className="subscription-card coming-orders-card">
            <div className="subscription-card__header">
                <h3 className="subscription-card__title">Coming orders</h3>
            </div>
            <div className="subscription-card__body">
                {loading && (
                    <div className="coming-orders-skeleton">
                        <SkeletonLine width="40%" />
                        <SkeletonBlock height={72} />
                        <SkeletonBlock height={72} />
                    </div>
                )}

                {!loading && error && (
                    <p className="subscription-empty-state">{error}</p>
                )}

                {!loading && !error && invoices.length === 0 && (
                    <p className="subscription-empty-state">No upcoming invoices.</p>
                )}

                {!loading && !error && invoices.length > 0 && (
                    <div className="coming-orders-timeline">
                        {invoices.map((invoice) => {
                            const busy =
                                Boolean(actionLoading) ||
                                actionLoading === `request-${invoice.id}` ||
                                actionLoading === `resend-${invoice.id}` ||
                                actionLoading === `reschedule-${invoice.id}`;
                            const isRescheduling = rescheduleId === invoice.id;

                            return (
                                <div
                                    key={invoice.id}
                                    className={`coming-orders-row coming-orders-row--${String(
                                        invoice.payment_status || "upcoming"
                                    ).toLowerCase()}`}
                                >
                                    <div className="coming-orders-row__marker" aria-hidden>
                                        <span />
                                    </div>
                                    <div className="coming-orders-row__content">
                                        <div className="coming-orders-row__top">
                                            <div className="coming-orders-row__title-wrap">
                                                <p className="coming-orders-row__title">
                                                    #{invoice.cycle_index}
                                                </p>
                                                {invoice.is_next && (
                                                    <s-badge tone="info">Next invoice</s-badge>
                                                )}
                                            </div>
                                            <s-badge tone={statusTone(invoice.payment_status)}>
                                                {statusLabel(invoice.payment_status)}
                                            </s-badge>
                                        </div>

                                        <p className="coming-orders-row__meta">
                                            Scheduled for {formatDateTime(invoice.scheduled_at)}
                                        </p>
                                        {invoice.email_sent_at && (
                                            <p className="coming-orders-row__meta">
                                                Sent {formatDateTime(invoice.email_sent_at)}
                                            </p>
                                        )}

                                        {!actionsDisabled && !isRescheduling && (
                                            <div className="coming-orders-row__actions">
                                                {invoice.can_request_now && invoice.is_next && (
                                                    <s-button
                                                        variant="primary"
                                                        disabled={busy}
                                                        onClick={() => onRequestNow(invoice.id)}
                                                    >
                                                        {actionLoading === `request-${invoice.id}`
                                                            ? "Sending…"
                                                            : "Request invoice now"}
                                                    </s-button>
                                                )}
                                                {invoice.can_resend && (
                                                    <s-button
                                                        variant="secondary"
                                                        disabled={busy}
                                                        onClick={() => onResendEmail(invoice.id)}
                                                    >
                                                        {actionLoading === `resend-${invoice.id}`
                                                            ? "Sending…"
                                                            : "Resend email"}
                                                    </s-button>
                                                )}
                                                {invoice.can_reschedule && (
                                                    <s-button
                                                        variant="secondary"
                                                        disabled={busy}
                                                        onClick={() => openReschedule(invoice)}
                                                    >
                                                        Reschedule
                                                    </s-button>
                                                )}
                                                {invoice.invoice_url && (
                                                    <s-button
                                                        variant="tertiary"
                                                        href={invoice.invoice_url}
                                                        target="_blank"
                                                    >
                                                        View invoice
                                                    </s-button>
                                                )}
                                            </div>
                                        )}

                                        {isRescheduling && (
                                            <div className="coming-orders-reschedule">
                                                <input
                                                    type="datetime-local"
                                                    className="coming-orders-reschedule__input"
                                                    value={rescheduleValue}
                                                    onChange={(event) =>
                                                        setRescheduleValue(event.target.value)
                                                    }
                                                />
                                                <div className="coming-orders-row__actions">
                                                    <s-button
                                                        variant="primary"
                                                        disabled={busy || !rescheduleValue}
                                                        onClick={() =>
                                                            submitReschedule(invoice.id)
                                                        }
                                                    >
                                                        {actionLoading ===
                                                        `reschedule-${invoice.id}`
                                                            ? "Saving…"
                                                            : "Save"}
                                                    </s-button>
                                                    <s-button
                                                        variant="secondary"
                                                        disabled={busy}
                                                        onClick={cancelReschedule}
                                                    >
                                                        Cancel
                                                    </s-button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
