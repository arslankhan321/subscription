import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSubscriptionDetail } from "@/hooks/subscriptions/useSubscriptionDetail";
import { useBillingCycles } from "@/hooks/subscriptions/useBillingCycles";
import {
    formatCustomerName,
    formatDateTime,
    formatMoney,
    formatPaymentMethod,
    formatShippingAddress,
    formatSubscriptionStatus,
    getBillingCycleStatusTone,
    getSubscriptionStatusTone,
    goToSubscriptionsList,
} from "@/utils/subscriptionHelpers";
import "@/styles/subscriptions.css";

function toDateTimeLocalValue(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const pad = (n) => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function clampDateTimeLocalValue(value, minValue, maxValue) {
    if (!value) {
        return minValue || "";
    }

    if (minValue && value < minValue) {
        return minValue;
    }

    if (maxValue && value > maxValue) {
        return maxValue;
    }

    return value;
}

function isUnbilledCycle(cycle) {
    const status = String(cycle?.status || "").toUpperCase();
    return !cycle?.skipped && status !== "BILLED" && !cycle?.billing_attempt?.order_name;
}

function BillingCyclesCard({
    billingCycles,
    loading,
    loadingMore,
    actionLoading,
    error,
    hasNextPage,
    firstUnbilledIndex,
    onLoadMore,
    onCharge,
    onSkip,
    onUnskip,
    onReschedule,
}) {
    const [rescheduleIndex, setRescheduleIndex] = useState(null);
    const [rescheduleValue, setRescheduleValue] = useState("");
    const [rescheduleMin, setRescheduleMin] = useState("");
    const [rescheduleMax, setRescheduleMax] = useState("");

    const openReschedule = (cycle) => {
        const minValue = toDateTimeLocalValue(cycle.cycle_start_at);
        const maxValue = toDateTimeLocalValue(
            cycle.cycle_end_at || cycle.billing_attempt_expected_date
        );
        const currentValue = clampDateTimeLocalValue(
            toDateTimeLocalValue(cycle.billing_attempt_expected_date),
            minValue,
            maxValue
        );

        setRescheduleIndex(cycle.cycle_index);
        setRescheduleMin(minValue);
        setRescheduleMax(maxValue);
        setRescheduleValue(currentValue);
    };

    const submitReschedule = async (cycleIndex) => {
        if (!rescheduleValue) {
            return;
        }

        const clamped = clampDateTimeLocalValue(rescheduleValue, rescheduleMin, rescheduleMax);

        if (clamped !== rescheduleValue) {
            setRescheduleValue(clamped);
            return;
        }

        await onReschedule(cycleIndex, new Date(clamped).toISOString());
        setRescheduleIndex(null);
        setRescheduleValue("");
        setRescheduleMin("");
        setRescheduleMax("");
    };

    return (
        <div className="subscription-card">
            <div className="subscription-card__header">
                <h3 className="subscription-card__title">Billing schedule</h3>
                <s-badge tone="info">Live from Shopify</s-badge>
            </div>
            <div className="subscription-card__body">
                {loading ? (
                    <s-box padding="base">
                        <s-spinner accessibilityLabel="Loading billing schedule" size="base" />
                    </s-box>
                ) : error ? (
                    <s-banner tone="warning">{error}</s-banner>
                ) : !billingCycles?.length ? (
                    <p className="subscription-address-line">No billing cycles available yet.</p>
                ) : (
                    <>
                        <div className="billing-cycle-list">
                            {billingCycles.map((cycle) => {
                                const canCharge =
                                    firstUnbilledIndex !== null &&
                                    cycle.cycle_index === firstUnbilledIndex &&
                                    isUnbilledCycle(cycle);
                                const isBusy = Boolean(actionLoading);
                                const cycleBusy = actionLoading?.endsWith(`-${cycle.cycle_index}`);
                                const minValue = toDateTimeLocalValue(cycle.cycle_start_at);
                                const maxValue = toDateTimeLocalValue(
                                    cycle.cycle_end_at || cycle.billing_attempt_expected_date
                                );

                                return (
                                    <div key={cycle.cycle_index} className="billing-cycle-row">
                                        <span className="billing-cycle-row__index">
                                            #{cycle.cycle_index}
                                        </span>

                                        <div className="billing-cycle-row__main">
                                            {!cycle.skipped &&
                                                String(cycle.status || "").toUpperCase() !== "BILLED" && (
                                                    <button
                                                        type="button"
                                                        className="billing-cycle-row__reschedule"
                                                        disabled={isBusy}
                                                        onClick={() => openReschedule(cycle)}
                                                    >
                                                        <s-icon type="calendar" />
                                                        Reschedule
                                                    </button>
                                                )}

                                            <p className="billing-cycle-row__date">
                                                {formatDateTime(cycle.billing_attempt_expected_date)}
                                            </p>

                                            {cycle.billing_attempt?.order_name && (
                                                <p className="billing-cycle-row__meta">
                                                    Order {cycle.billing_attempt.order_name}
                                                </p>
                                            )}

                                            {rescheduleIndex === cycle.cycle_index && (
                                                <div className="billing-cycle-row__reschedule-form">
                                                    <input
                                                        type="datetime-local"
                                                        value={rescheduleValue}
                                                        min={minValue || undefined}
                                                        max={maxValue || undefined}
                                                        onChange={(event) =>
                                                            setRescheduleValue(
                                                                clampDateTimeLocalValue(
                                                                    event.target.value,
                                                                    minValue,
                                                                    maxValue
                                                                )
                                                            )
                                                        }
                                                    />
                                                    <s-button
                                                        variant="primary"
                                                        disabled={
                                                            isBusy ||
                                                            !rescheduleValue ||
                                                            (minValue && rescheduleValue < minValue) ||
                                                            (maxValue && rescheduleValue > maxValue)
                                                        }
                                                        loading={
                                                            actionLoading ===
                                                            `reschedule-${cycle.cycle_index}`
                                                        }
                                                        onClick={() =>
                                                            submitReschedule(cycle.cycle_index)
                                                        }
                                                    >
                                                        Save
                                                    </s-button>
                                                    <s-button
                                                        disabled={isBusy}
                                                        onClick={() => {
                                                            setRescheduleIndex(null);
                                                            setRescheduleValue("");
                                                            setRescheduleMin("");
                                                            setRescheduleMax("");
                                                        }}
                                                    >
                                                        Cancel
                                                    </s-button>
                                                    {(minValue || maxValue) && (
                                                        <p className="billing-cycle-row__meta">
                                                            Allowed: {formatDateTime(cycle.cycle_start_at)}
                                                            {" → "}
                                                            {formatDateTime(
                                                                cycle.cycle_end_at ||
                                                                    cycle.billing_attempt_expected_date
                                                            )}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="billing-cycle-row__side">
                                            <div className="billing-cycle-row__actions-mid">
                                                {canCharge && (
                                                    <s-button
                                                        disabled={isBusy}
                                                        loading={
                                                            actionLoading ===
                                                            `charge-${cycle.cycle_index}`
                                                        }
                                                        onClick={() => onCharge(cycle.cycle_index)}
                                                    >
                                                        Charge now
                                                    </s-button>
                                                )}

                                                <s-badge
                                                    tone={
                                                        cycle.skipped
                                                            ? "warning"
                                                            : getBillingCycleStatusTone(cycle.status)
                                                    }
                                                >
                                                    {cycle.skipped
                                                        ? "Skipped"
                                                        : cycle.status || "Scheduled"}
                                                </s-badge>
                                            </div>

                                            {String(cycle.status || "").toUpperCase() !== "BILLED" &&
                                                (cycle.skipped ? (
                                                    <button
                                                        type="button"
                                                        className="billing-cycle-row__link"
                                                        disabled={isBusy}
                                                        onClick={() => onUnskip(cycle.cycle_index)}
                                                    >
                                                        {cycleBusy &&
                                                        actionLoading?.startsWith("unskip")
                                                            ? "Working..."
                                                            : "Unskip"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="billing-cycle-row__link"
                                                        disabled={isBusy}
                                                        onClick={() => onSkip(cycle.cycle_index)}
                                                    >
                                                        {cycleBusy &&
                                                        actionLoading?.startsWith("skip")
                                                            ? "Working..."
                                                            : "Skip"}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {hasNextPage && (
                            <div style={{ marginTop: "0.85rem" }}>
                                <s-button
                                    onClick={onLoadMore}
                                    loading={loadingMore}
                                    disabled={loadingMore || Boolean(actionLoading)}
                                >
                                    {loadingMore ? "Loading..." : "Load more cycles"}
                                </s-button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function SubscriptionShow() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { subscription, loading, error } = useSubscriptionDetail(id);
    const {
        cycles: billingCycles,
        pageInfo,
        loading: billingLoading,
        loadingMore,
        actionLoading,
        error: billingError,
        firstUnbilledIndex,
        loadMore,
        chargeCycle,
        skipCycle,
        unskipCycle,
        rescheduleCycle,
    } = useBillingCycles(id, { enabled: Boolean(id) });

    if (loading) {
        return (
            <div className="subscriptions-page">
                <s-page heading="Subscription">
                    <s-box padding="large">
                        <s-spinner accessibilityLabel="Loading subscription" size="large" />
                    </s-box>
                </s-page>
            </div>
        );
    }

    if (error || !subscription) {
        return (
            <div className="subscriptions-page">
                <s-page heading="Subscription">
                    <s-banner tone="critical">{error || "Subscription not found"}</s-banner>
                    <s-button onClick={() => goToSubscriptionsList(navigate)}>
                        Back to subscriptions
                    </s-button>
                </s-page>
            </div>
        );
    }

    const shippingLines = formatShippingAddress(subscription.shipping);

    return (
        <div className="subscriptions-page">
            <s-page heading={`Subscription ${subscription.reference}`}>
                <button
                    type="button"
                    className="subscription-back-link"
                    onClick={() => goToSubscriptionsList(navigate)}
                >
                    ← Back to subscriptions
                </button>

                <div className="subscription-detail-header">
                    <div>
                        <h2 className="subscription-detail-header__title">
                            Subscription {subscription.reference}
                        </h2>
                        <s-badge tone={getSubscriptionStatusTone(subscription.status)}>
                            {formatSubscriptionStatus(subscription.status)}
                        </s-badge>
                    </div>

                    <div className="subscription-detail-header__actions">
                        <s-button disabled>Pause subscription</s-button>
                        <s-button disabled>Cancel subscription</s-button>
                        <s-button variant="primary" disabled>
                            Edit subscription
                        </s-button>
                    </div>
                </div>

                <div className="subscription-detail-grid">
                    <s-stack direction="block" gap="base">
                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Overview</h3>
                            </div>
                            <div className="subscription-card__body">
                                <div className="subscription-overview-grid">
                                    <div>
                                        <span className="subscription-overview-item__label">Status</span>
                                        <span className="subscription-overview-item__value">
                                            {formatSubscriptionStatus(subscription.status)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="subscription-overview-item__label">Created</span>
                                        <span className="subscription-overview-item__value">
                                            {formatDateTime(subscription.created_at)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="subscription-overview-item__label">Frequency</span>
                                        <span className="subscription-overview-item__value">
                                            {subscription.frequency_label || "—"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="subscription-overview-item__label">Type</span>
                                        <span className="subscription-overview-item__value">
                                            {subscription.subscription_type}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="subscription-overview-item__label">
                                            Next billing
                                        </span>
                                        <span className="subscription-overview-item__value">
                                            {formatDateTime(subscription.next_billing_date)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="subscription-overview-item__label">
                                            Contract ID
                                        </span>
                                        <span className="subscription-overview-item__value">
                                            {subscription.shopify_contract_id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Items</h3>
                            </div>
                            <div className="subscription-card__body">
                                {subscription.products.map((product) => (
                                    <div key={product.id} className="subscription-item-row">
                                        {product.image_url ? (
                                            <img
                                                className="subscription-item-row__image"
                                                src={product.image_url}
                                                alt={product.title}
                                            />
                                        ) : (
                                            <div className="subscription-item-row__placeholder">
                                                ITEM
                                            </div>
                                        )}

                                        <div>
                                            <p className="subscription-item-row__title">
                                                {product.title}
                                            </p>
                                            <p className="subscription-item-row__meta">
                                                {product.variant_title || "Default variant"}
                                                {product.sku ? ` • SKU: ${product.sku}` : ""}
                                            </p>
                                            <p className="subscription-item-row__meta">
                                                {product.quantity} x{" "}
                                                {formatMoney(
                                                    product.current_price,
                                                    product.currency_code
                                                )}
                                            </p>
                                        </div>

                                        <div className="subscription-item-row__price">
                                            {formatMoney(
                                                product.current_price * product.quantity,
                                                product.currency_code
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Delivery method</h3>
                            </div>
                            <div className="subscription-card__body">
                                <p className="subscription-item-row__title">
                                    {subscription.shipping?.shipping_option_title ||
                                        "Standard shipping"}
                                </p>
                                <p className="subscription-item-row__meta">
                                    {formatMoney(
                                        subscription.delivery_price,
                                        subscription.delivery_price_currency ||
                                            subscription.currency_code
                                    )}
                                </p>
                            </div>
                        </div>

                        <BillingCyclesCard
                            billingCycles={billingCycles}
                            loading={billingLoading}
                            loadingMore={loadingMore}
                            actionLoading={actionLoading}
                            error={billingError}
                            hasNextPage={pageInfo.has_next_page}
                            firstUnbilledIndex={firstUnbilledIndex}
                            onLoadMore={loadMore}
                            onCharge={chargeCycle}
                            onSkip={skipCycle}
                            onUnskip={unskipCycle}
                            onReschedule={rescheduleCycle}
                        />

                        {subscription.recurring_orders?.length > 0 && (
                            <div className="subscription-card">
                                <div className="subscription-card__header">
                                    <h3 className="subscription-card__title">Generated orders</h3>
                                </div>
                                <div className="subscription-card__body">
                                    {subscription.recurring_orders.map((order) => (
                                        <div key={order.id} className="billing-cycle-row">
                                            <span className="billing-cycle-row__index">#</span>
                                            <div>
                                                <p className="billing-cycle-row__date">
                                                    {order.order_name ||
                                                        `Order ${order.shopify_order_id}`}
                                                </p>
                                                <p className="billing-cycle-row__meta">
                                                    {formatDateTime(order.processed_at)} •{" "}
                                                    {order.financial_status || "Unknown status"}
                                                </p>
                                            </div>
                                            <span className="subscription-item-row__price">
                                                {formatMoney(order.total_price, order.currency_code)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </s-stack>

                    <div className="subscription-side-stack">
                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Customer</h3>
                            </div>
                            <div className="subscription-card__body">
                                <p className="subscription-item-row__title">
                                    {formatCustomerName(subscription.customer)}
                                </p>
                                <p className="subscription-item-row__meta">
                                    {subscription.customer?.email || "No email"}
                                </p>
                                {subscription.customer?.phone && (
                                    <p className="subscription-item-row__meta">
                                        {subscription.customer.phone}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Shipping address</h3>
                            </div>
                            <div className="subscription-card__body">
                                {shippingLines ? (
                                    shippingLines.map((line) => (
                                        <p key={line} className="subscription-address-line">
                                            {line}
                                        </p>
                                    ))
                                ) : (
                                    <p className="subscription-address-line">
                                        No shipping address saved.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Payment method</h3>
                            </div>
                            <div className="subscription-card__body">
                                <p className="subscription-address-line">
                                    {formatPaymentMethod(subscription.payment_method)}
                                </p>
                                {subscription.payment_method?.expiry_month &&
                                    subscription.payment_method?.expiry_year && (
                                        <p className="subscription-item-row__meta">
                                            Expires {subscription.payment_method.expiry_month}/
                                            {subscription.payment_method.expiry_year}
                                        </p>
                                    )}
                            </div>
                        </div>

                        {subscription.shopify_origin_order_id && (
                            <div className="subscription-card">
                                <div className="subscription-card__header">
                                    <h3 className="subscription-card__title">Initial order</h3>
                                </div>
                                <div className="subscription-card__body">
                                    <div className="subscription-initial-order">
                                        <div>
                                            <p className="subscription-initial-order__label">
                                                Origin order
                                            </p>
                                            <p className="subscription-initial-order__value">
                                                #{subscription.shopify_origin_order_id}
                                            </p>
                                        </div>
                                        <s-badge tone="success">Payment processed</s-badge>
                                    </div>
                                </div>
                            </div>
                        )}

                        {subscription.note && (
                            <div className="subscription-card">
                                <div className="subscription-card__header">
                                    <h3 className="subscription-card__title">Admin notes</h3>
                                </div>
                                <div className="subscription-card__body">
                                    <p className="subscription-address-line">{subscription.note}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </s-page>
        </div>
    );
}
