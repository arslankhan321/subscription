import { useEffect, useRef, useState } from "react";
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

function statusTone(bucket) {
    switch (bucket) {
        case "fulfilled":
            return "success";
        case "scheduled":
            return "info";
        case "cancelled":
            return "warning";
        case "in_progress":
            return "info";
        default:
            return "caution";
    }
}

function FulfillmentMenu({ open, onClose, canReschedule, canSkip, canRefund, busy, onReschedule, onSkip, onRefund }) {
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const onDocClick = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return (
        <div className="fulfillment-menu" ref={menuRef} role="menu">
            {canReschedule && (
                <button
                    type="button"
                    className="fulfillment-menu__item"
                    disabled={busy}
                    onClick={onReschedule}
                >
                    <span className="fulfillment-menu__icon" aria-hidden>
                        📅
                    </span>
                    Reschedule
                </button>
            )}
            {canSkip && (
                <button
                    type="button"
                    className="fulfillment-menu__item"
                    disabled={busy}
                    onClick={onSkip}
                >
                    <span className="fulfillment-menu__icon" aria-hidden>
                        ⏭
                    </span>
                    Skip fulfillment
                </button>
            )}
            {canRefund && (
                <button
                    type="button"
                    className="fulfillment-menu__item fulfillment-menu__item--danger"
                    disabled={busy}
                    onClick={onRefund}
                >
                    <span className="fulfillment-menu__icon" aria-hidden>
                        ↩
                    </span>
                    Refund fulfillment
                </button>
            )}
        </div>
    );
}

function FulfillmentRow({
    fulfillment,
    expanded,
    onToggle,
    menuOpen,
    onMenuToggle,
    onMenuClose,
    actionLoading,
    rescheduleId,
    rescheduleValue,
    onRescheduleChange,
    onRescheduleSubmit,
    onRescheduleCancel,
    onOpenReschedule,
    onSkip,
    onRefund,
}) {
    const busy =
        actionLoading === `reschedule-${fulfillment.id}` ||
        actionLoading === `skip-${fulfillment.id}` ||
        actionLoading === `refund-${fulfillment.id}`;

    const itemsLabel =
        fulfillment.line_items?.map((item) => item.name).filter(Boolean).join(", ") || "—";
    const trackingLabel = fulfillment.tracking?.number
        ? fulfillment.tracking.url
            ? fulfillment.tracking.number
            : fulfillment.tracking.number
        : "—";

    return (
        <div
            className={`fulfillment-row fulfillment-row--${fulfillment.status_bucket || "unfulfilled"}${
                expanded ? " fulfillment-row--expanded" : ""
            }`}
        >
            <button
                type="button"
                className="fulfillment-row__marker"
                aria-label={expanded ? "Collapse" : "Expand"}
                onClick={onToggle}
            >
                <span className="fulfillment-row__marker-icon" aria-hidden>
                    {fulfillment.status_bucket === "scheduled" ? "📅" : "⏳"}
                </span>
            </button>

            <div className="fulfillment-row__body">
                <div className="fulfillment-row__header">
                    <button type="button" className="fulfillment-row__title-btn" onClick={onToggle}>
                        <span className="fulfillment-row__title">
                            {fulfillment.order_name || "Order"} {fulfillment.display_status}
                        </span>
                        {fulfillment.fulfill_at && (
                            <span className="fulfillment-row__when">
                                📅 {formatDateTime(fulfillment.fulfill_at)}
                            </span>
                        )}
                    </button>

                    <div className="fulfillment-row__side">
                        <s-badge tone={statusTone(fulfillment.status_bucket)}>
                            {fulfillment.display_status}
                        </s-badge>
                        {fulfillment.fulfill_at && (
                            <span className="fulfillment-row__side-date">
                                {formatDateTime(fulfillment.fulfill_at)}
                            </span>
                        )}
                        <div className="fulfillment-row__menu-wrap">
                            <button
                                type="button"
                                className="fulfillment-row__menu-btn"
                                aria-label="Fulfillment actions"
                                disabled={
                                    busy ||
                                    fulfillment.status_bucket === "unfulfilled" ||
                                    !(
                                        fulfillment.can_reschedule ||
                                        fulfillment.can_skip ||
                                        fulfillment.can_refund
                                    )
                                }
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onMenuToggle();
                                }}
                            >
                                ⋯
                            </button>
                            <FulfillmentMenu
                                open={menuOpen}
                                onClose={onMenuClose}
                                canReschedule={fulfillment.can_reschedule}
                                canSkip={fulfillment.can_skip}
                                canRefund={fulfillment.can_refund}
                                busy={busy}
                                onReschedule={() => {
                                    onMenuClose();
                                    onOpenReschedule();
                                }}
                                onSkip={() => {
                                    onMenuClose();
                                    onSkip();
                                }}
                                onRefund={() => {
                                    onMenuClose();
                                    onRefund();
                                }}
                            />
                        </div>
                    </div>
                </div>

                {expanded && (
                    <div className="fulfillment-row__details">
                        <div className="fulfillment-row__detail">
                            <span className="fulfillment-row__detail-label">Items</span>
                            <span className="fulfillment-row__detail-value">{itemsLabel}</span>
                        </div>
                        <div className="fulfillment-row__detail">
                            <span className="fulfillment-row__detail-label">Destination</span>
                            <span className="fulfillment-row__detail-value">
                                {fulfillment.destination || "—"}
                            </span>
                        </div>
                        <div className="fulfillment-row__detail">
                            <span className="fulfillment-row__detail-label">Tracking</span>
                            <span className="fulfillment-row__detail-value">
                                {fulfillment.tracking?.url ? (
                                    <a
                                        href={fulfillment.tracking.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {trackingLabel}
                                    </a>
                                ) : (
                                    trackingLabel
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {rescheduleId === fulfillment.id && (
                    <div className="fulfillment-row__reschedule">
                        <input
                            type="datetime-local"
                            value={rescheduleValue}
                            onChange={(event) => onRescheduleChange(event.target.value)}
                            required
                        />
                        <s-button
                            variant="primary"
                            disabled={busy || !rescheduleValue}
                            loading={actionLoading === `reschedule-${fulfillment.id}`}
                            onClick={onRescheduleSubmit}
                        >
                            Save
                        </s-button>
                        <s-button disabled={busy} onClick={onRescheduleCancel}>
                            Cancel
                        </s-button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function FulfillmentCard({
    summary,
    fulfillments,
    loading,
    actionLoading,
    error,
    actionsDisabled = false,
    onReschedule,
    onSkip,
    onRefund,
}) {
    const [expandedId, setExpandedId] = useState(null);
    const [menuId, setMenuId] = useState(null);
    const [rescheduleId, setRescheduleId] = useState(null);
    const [rescheduleValue, setRescheduleValue] = useState("");

    useEffect(() => {
        if (!fulfillments?.length) {
            setExpandedId(null);
            return;
        }

        const firstPending = fulfillments.find((fo) =>
            ["unfulfilled", "scheduled", "in_progress"].includes(fo.status_bucket)
        );

        setExpandedId((current) => current ?? firstPending?.id ?? fulfillments[0]?.id ?? null);
    }, [fulfillments]);

    const progress = Number(summary?.progress ?? 0);

    if (loading && !fulfillments?.length) {
        return (
            <div className="subscription-card">
                <div className="subscription-card__header">
                    <h3 className="subscription-card__title">Fulfillment</h3>
                </div>
                <div className="subscription-card__body">
                    <SkeletonBlock height={72} />
                    <SkeletonLine width="80%" />
                    <SkeletonLine width="60%" />
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-card fulfillment-card">
            <div className="subscription-card__header">
                <h3 className="subscription-card__title">Fulfillment</h3>
            </div>

            <div className="subscription-card__body">
                {error && <p className="subscription-inline-error">{error}</p>}

                <div className="fulfillment-stats">
                    <div className="fulfillment-stat fulfillment-stat--total">
                        <span className="fulfillment-stat__dot" />
                        <div>
                            <span className="fulfillment-stat__value">{summary?.total ?? 0}</span>
                            <span className="fulfillment-stat__label">Total Orders</span>
                        </div>
                    </div>
                    <div className="fulfillment-stat fulfillment-stat--fulfilled">
                        <span className="fulfillment-stat__dot" />
                        <div>
                            <span className="fulfillment-stat__value">{summary?.fulfilled ?? 0}</span>
                            <span className="fulfillment-stat__label">Fulfilled</span>
                        </div>
                    </div>
                    <div className="fulfillment-stat fulfillment-stat--pending">
                        <span className="fulfillment-stat__dot" />
                        <div>
                            <span className="fulfillment-stat__value">{summary?.pending ?? 0}</span>
                            <span className="fulfillment-stat__label">Pending</span>
                        </div>
                    </div>
                    <div className="fulfillment-stat fulfillment-stat--next">
                        <span className="fulfillment-stat__dot" />
                        <div>
                            <span className="fulfillment-stat__value fulfillment-stat__value--date">
                                {summary?.next_fulfillment
                                    ? formatDateTime(summary.next_fulfillment)
                                    : "—"}
                            </span>
                            <span className="fulfillment-stat__label">Next Fulfillment</span>
                        </div>
                    </div>
                </div>

                <div className="fulfillment-progress">
                    <div className="fulfillment-progress__labels">
                        <span>Progress</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="fulfillment-progress__track" aria-hidden>
                        <div
                            className="fulfillment-progress__fill"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                    </div>
                </div>

                {fulfillments?.length > 0 ? (
                    <div className="fulfillment-timeline">
                        {fulfillments.map((fulfillment) => (
                            <FulfillmentRow
                                key={fulfillment.id}
                                fulfillment={fulfillment}
                                expanded={expandedId === fulfillment.id}
                                onToggle={() =>
                                    setExpandedId((current) =>
                                        current === fulfillment.id ? null : fulfillment.id
                                    )
                                }
                                menuOpen={menuId === fulfillment.id}
                                onMenuToggle={() =>
                                    setMenuId((current) =>
                                        current === fulfillment.id ? null : fulfillment.id
                                    )
                                }
                                onMenuClose={() => setMenuId(null)}
                                actionLoading={actionLoading}
                                rescheduleId={rescheduleId}
                                rescheduleValue={rescheduleValue}
                                onRescheduleChange={setRescheduleValue}
                                onOpenReschedule={() => {
                                    if (actionsDisabled) {
                                        return;
                                    }
                                    setRescheduleId(fulfillment.id);
                                    setRescheduleValue(toDateTimeLocalValue(fulfillment.fulfill_at));
                                }}
                                onRescheduleCancel={() => {
                                    setRescheduleId(null);
                                    setRescheduleValue("");
                                }}
                                onRescheduleSubmit={() => {
                                    if (!rescheduleValue || actionsDisabled) {
                                        return;
                                    }
                                    const iso = new Date(rescheduleValue).toISOString();
                                    onReschedule?.(fulfillment.id, iso);
                                    setRescheduleId(null);
                                    setRescheduleValue("");
                                }}
                                onSkip={() => {
                                    if (actionsDisabled) {
                                        return;
                                    }
                                    onSkip?.(fulfillment.id);
                                }}
                                onRefund={() => {
                                    if (actionsDisabled) {
                                        return;
                                    }
                                    if (
                                        window.confirm(
                                            "Refund this fulfillment cycle? This cannot be undone easily."
                                        )
                                    ) {
                                        onRefund?.(fulfillment.id);
                                    }
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="subscription-empty-note">
                        No fulfillment orders yet. They appear after the prepaid order is created.
                    </p>
                )}

                <div className="fulfillment-info">
                    <span className="fulfillment-info__icon" aria-hidden>
                        ⓘ
                    </span>
                    <p>
                        Fulfillment orders are created automatically based on your billing schedule.
                        You can manage or update each fulfillment using the actions menu.
                    </p>
                </div>
            </div>
        </div>
    );
}
