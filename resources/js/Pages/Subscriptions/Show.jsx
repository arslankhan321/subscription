import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSubscriptionDetail } from "@/hooks/subscriptions/useSubscriptionDetail";
import { useBillingCycles } from "@/hooks/subscriptions/useBillingCycles";
import { useFulfillments } from "@/hooks/subscriptions/useFulfillments";
import { useAddDiscountModal } from "@/Components/Subscriptions/AddDiscountModal";
import { useCancelSubscriptionModal } from "@/Components/Subscriptions/CancelSubscriptionModal";
import { CustomerCard } from "@/Components/Subscriptions/CustomerCard";
import { FulfillmentCard } from "@/Components/Subscriptions/FulfillmentCard";
import { PlanSubscriptionPricing } from "@/Components/Subscriptions/PlanSubscriptionPricing";
import SubscriptionActivityLog from "@/Components/Subscriptions/SubscriptionActivityLog";
import {
    PaymentMethodCard,
    useSwapPaymentMethodModal,
} from "@/Components/Subscriptions/PaymentMethodActions";
import {
    ShippingAddressCard,
    useEditShippingAddressModal,
    useSelectShippingAddressModal,
} from "@/Components/Subscriptions/ShippingAddressActions";
import {
    SkeletonBlock,
    SkeletonLine,
    SubscriptionShowSkeleton,
} from "@/Components/Skeletons";
import {
    pauseSubscription,
    removeSubscriptionDiscount,
    resumeSubscription,
    sendSubscriptionPaymentMethodUpdate,
} from "@/Services/subscriptionService";
import {
    calculateProductDiscountedTotal,
    formatDateTime,
    formatDiscountLabel,
    formatMoney,
    formatSubscriptionStatus,
    getBillingCycleStatusTone,
    getSubscriptionStatusTone,
    goToSubscriptionEdit,
    goToSubscriptionsList,
} from "@/utils/subscriptionHelpers";
import { detectBillingType } from "@/utils/subscriptionEditHelpers";
import { BILLING_TYPES } from "@/constants/planConstants";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/subscriptions.css";
import "@/styles/skeleton.css";

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
    actionsDisabled = false,
    isPrepaid = false,
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
        if (actionsDisabled || isPrepaid) {
            return;
        }

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
        if (!rescheduleValue || actionsDisabled || isPrepaid) {
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
                    <div className="skeleton-card">
                        <SkeletonLine width="40%" height={10} />
                        <SkeletonBlock width="100%" height={56} radius={12} />
                        <SkeletonBlock width="100%" height={56} radius={12} />
                        <SkeletonBlock width="100%" height={56} radius={12} />
                    </div>
                ) : error ? (
                    <s-banner tone="warning">{error}</s-banner>
                ) : !billingCycles?.length ? (
                    <p className="subscription-address-line">No billing cycles available yet.</p>
                ) : (
                    <>
                        {actionsDisabled && (
                            <s-banner tone="warning">
                                Billing actions are disabled while this subscription is paused or
                                cancelled.
                            </s-banner>
                        )}
                        <div className="billing-cycle-list">
                            {billingCycles.map((cycle) => {
                                const isChargeableCycle =
                                    firstUnbilledIndex !== null &&
                                    cycle.cycle_index === firstUnbilledIndex &&
                                    isUnbilledCycle(cycle);
                                const showCharge = isChargeableCycle;
                                const isBusy = Boolean(actionLoading) || actionsDisabled;
                                const cycleBusy = actionLoading?.endsWith(`-${cycle.cycle_index}`);
                                const minValue = toDateTimeLocalValue(cycle.cycle_start_at);
                                const maxValue = toDateTimeLocalValue(
                                    cycle.cycle_end_at || cycle.billing_attempt_expected_date
                                );
                                const showScheduleActions = !isPrepaid;
                                const showReschedule =
                                    showScheduleActions &&
                                    !cycle.skipped &&
                                    String(cycle.status || "").toUpperCase() !== "BILLED";
                                const showSkipToggle =
                                    showScheduleActions &&
                                    String(cycle.status || "").toUpperCase() !== "BILLED";

                                return (
                                    <div key={cycle.cycle_index} className="billing-cycle-row">
                                        <span className="billing-cycle-row__index">
                                            #{cycle.cycle_index}
                                        </span>

                                        <div className="billing-cycle-row__main">
                                            {showReschedule && (
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

                                            {showScheduleActions &&
                                                !actionsDisabled &&
                                                rescheduleIndex === cycle.cycle_index && (
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
                                                {showCharge && (
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

                                            {showSkipToggle &&
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
    const { subscription, loading, error, refetch, setSubscriptionData, setDiscounts, setPaymentMethod, setShipping, setCustomer } =
        useSubscriptionDetail(id);
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
    } = useBillingCycles(id, {
        enabled: Boolean(id),
        onActionComplete: () => refetch({ silent: true }),
    });

    const isPrepaid =
        detectBillingType(subscription) === BILLING_TYPES.PREPAID;

    const {
        summary: fulfillmentSummary,
        fulfillments,
        loading: fulfillmentLoading,
        actionLoading: fulfillmentActionLoading,
        error: fulfillmentError,
        rescheduleFulfillment,
        skipFulfillment,
        refundFulfillment,
    } = useFulfillments(id, {
        enabled: Boolean(id) && isPrepaid,
        onActionComplete: () => refetch({ silent: true }),
    });

    const { open: openDiscountModal, modal: discountModal } = useAddDiscountModal({
        subscriptionId: id,
        products: subscription?.products ?? [],
        onAdded: setDiscounts,
    });
    const { open: openSwapPaymentModal, modal: swapPaymentModal } = useSwapPaymentMethodModal({
        subscriptionId: id,
        onSwapped: setPaymentMethod,
    });
    const { open: openSelectAddressModal, modal: selectAddressModal } =
        useSelectShippingAddressModal({
            subscriptionId: id,
            onUpdated: setShipping,
        });
    const { open: openEditAddressModal, modal: editAddressModal } = useEditShippingAddressModal({
        subscriptionId: id,
        shipping: subscription?.shipping,
        onUpdated: setShipping,
    });
    const { open: openCancelModal, modal: cancelModal, cancelling } = useCancelSubscriptionModal({
        onCancelled: (data) => {
            if (data) {
                setSubscriptionData(data);
            } else {
                refetch({ silent: true });
            }
        },
    });
    const [deletingDiscountId, setDeletingDiscountId] = useState(null);
    const [sendingPaymentUpdate, setSendingPaymentUpdate] = useState(false);
    const [statusAction, setStatusAction] = useState(null);

    const status = String(subscription?.status || "").toLowerCase();
    const canPause = status === "active";
    const canResume = status === "paused" || status === "failed";
    const canCancel = status !== "cancelled" && status !== "expired";
    const canEdit = status !== "cancelled" && status !== "expired";
    const actionsBusy = Boolean(statusAction) || cancelling;
    const billingActionsDisabled =
        status === "paused" || status === "cancelled" || status === "expired";

    const handleStatusAction = async (action) => {
        if (!id || statusAction || action === "cancel") {
            return;
        }

        setStatusAction(action);

        try {
            const response =
                action === "pause"
                    ? await pauseSubscription(id)
                    : await resumeSubscription(id);

            showToast(
                response.data?.message ||
                    (action === "pause"
                        ? "Subscription paused"
                        : "Subscription resumed")
            );

            if (response.data?.data) {
                setSubscriptionData(response.data.data);
            } else {
                await refetch({ silent: true });
            }
        } catch (err) {
            showToast(
                getApiErrorMessage(
                    err,
                    action === "pause"
                        ? "Unable to pause subscription"
                        : "Unable to resume subscription"
                ),
                { isError: true }
            );
        } finally {
            setStatusAction(null);
        }
    };

    const handleDeleteDiscount = async (discountId) => {
        if (!id || !discountId || deletingDiscountId) {
            return;
        }

        setDeletingDiscountId(discountId);

        try {
            const response = await removeSubscriptionDiscount(id, discountId);
            setDiscounts(response.data?.data ?? []);
            showToast(response.data?.message || "Discount removed");
        } catch (err) {
            showToast(getApiErrorMessage(err, "Unable to remove discount"), { isError: true });
        } finally {
            setDeletingDiscountId(null);
        }
    };

    const handleSendPaymentUpdate = async () => {
        if (!id || sendingPaymentUpdate) {
            return;
        }

        setSendingPaymentUpdate(true);

        try {
            const response = await sendSubscriptionPaymentMethodUpdate(id);
            showToast(response.data?.message || "Update link sent");
        } catch (err) {
            showToast(getApiErrorMessage(err, "Unable to send update link"), { isError: true });
        } finally {
            setSendingPaymentUpdate(false);
        }
    };

    const handleManageCustomerPayment = () => {
        const url = subscription?.payment_method?.customer_admin_url;
        if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const handleManageCustomerAddresses = () => {
        const url =
            subscription?.customer?.admin_url ||
            subscription?.shipping?.customer_admin_url ||
            subscription?.payment_method?.customer_admin_url;

        if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    if (loading) {
        return (
            <div className="subscriptions-page">
                <s-page heading="Subscription">
                    <SubscriptionShowSkeleton />
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
                        {canPause && (
                            <s-button
                                loading={statusAction === "pause"}
                                disabled={actionsBusy}
                                onClick={() => handleStatusAction("pause")}
                            >
                                Pause subscription
                            </s-button>
                        )}
                        {canResume && (
                            <s-button
                                variant="primary"
                                loading={statusAction === "resume"}
                                disabled={actionsBusy}
                                onClick={() => handleStatusAction("resume")}
                            >
                                Resume subscription
                            </s-button>
                        )}
                        {canCancel && (
                            <s-button
                                tone="critical"
                                disabled={actionsBusy}
                                onClick={() => openCancelModal(subscription)}
                            >
                                Cancel subscription
                            </s-button>
                        )}
                        {canEdit && (
                            <s-button
                                variant={canResume ? "secondary" : "primary"}
                                disabled={actionsBusy}
                                onClick={() => goToSubscriptionEdit(navigate, id)}
                            >
                                Edit subscription
                            </s-button>
                        )}
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
                                {subscription.products.map((product) => {
                                    const pricing = calculateProductDiscountedTotal(
                                        product,
                                        subscription.discounts ?? []
                                    );
                                    const currency =
                                        product.currency_code || subscription.currency_code;

                                    return (
                                        <div
                                            key={product.id}
                                            className="subscription-item-block"
                                        >
                                            <div className="subscription-item-row">
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
                                                    {product.selling_plan_name ? (
                                                        <p className="subscription-item-row__meta">
                                                            {product.selling_plan_name}
                                                        </p>
                                                    ) : null}
                                                    <p className="subscription-item-row__meta">
                                                        {product.quantity} x{" "}
                                                        {pricing.has_discount ? (
                                                            <>
                                                                <span className="subscription-price--original">
                                                                    {formatMoney(
                                                                        pricing.unit_price,
                                                                        currency
                                                                    )}
                                                                </span>{" "}
                                                                <span className="subscription-price--discounted">
                                                                    {formatMoney(
                                                                        pricing.discounted_unit_price,
                                                                        currency
                                                                    )}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            formatMoney(
                                                                pricing.unit_price,
                                                                currency
                                                            )
                                                        )}
                                                    </p>
                                                    {pricing.applicable_discounts.length > 0 && (
                                                        <div className="subscription-item-discounts">
                                                            {pricing.applicable_discounts.map(
                                                                (discount) => (
                                                                    <s-badge
                                                                        key={discount.id}
                                                                        tone="success"
                                                                    >
                                                                        {discount.title}:{" "}
                                                                        {formatDiscountLabel(
                                                                            discount,
                                                                            currency
                                                                        )}
                                                                    </s-badge>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="subscription-item-row__price">
                                                    {pricing.has_discount ? (
                                                        <>
                                                            <span className="subscription-price--original">
                                                                {formatMoney(
                                                                    pricing.original_total,
                                                                    currency
                                                                )}
                                                            </span>
                                                            <span className="subscription-price--discounted">
                                                                {formatMoney(
                                                                    pricing.discounted_total,
                                                                    currency
                                                                )}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        formatMoney(
                                                            pricing.original_total,
                                                            currency
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <PlanSubscriptionPricing
                                                planDiscount={product.plan_discount}
                                                currencyCode={currency}
                                            />
                                        </div>
                                    );
                                })}

                                <div className="subscription-items-discounts">
                                    <div className="subscription-items-discounts__header">
                                        <h4 className="subscription-items-discounts__title">
                                            Applied discounts
                                        </h4>
                                    </div>

                                    {(subscription.discounts ?? []).length > 0 ? (
                                        <div className="subscription-discount-list">
                                            {(subscription.discounts ?? []).map((discount) => (
                                                <div
                                                    key={discount.id}
                                                    className="subscription-discount-item subscription-discount-item--row"
                                                >
                                                    <div>
                                                        <p className="subscription-discount-item__title">
                                                            {discount.title}
                                                        </p>
                                                        <p className="subscription-discount-item__meta">
                                                            {formatDiscountLabel(
                                                                discount,
                                                                subscription.currency_code
                                                            )}
                                                            {discount.recurring_cycle_limit
                                                                ? ` • ${discount.recurring_cycle_limit} cycle(s)`
                                                                : " • Unlimited cycles"}
                                                            {discount.applies_to_all
                                                                ? " • All items"
                                                                : discount.lines?.length
                                                                  ? ` • ${discount.lines
                                                                        .map((line) => line.title)
                                                                        .filter(Boolean)
                                                                        .join(", ")}`
                                                                  : " • Selected items"}
                                                        </p>
                                                    </div>

                                                    <s-button
                                                        tone="critical"
                                                        disabled={Boolean(deletingDiscountId)}
                                                        loading={deletingDiscountId === discount.id}
                                                        onClick={() =>
                                                            handleDeleteDiscount(discount.id)
                                                        }
                                                    >
                                                        Delete
                                                    </s-button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="subscription-address-line">
                                            No discounts applied to these items.
                                        </p>
                                    )}
                                </div>
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
                            actionsDisabled={billingActionsDisabled}
                            isPrepaid={isPrepaid}
                            onLoadMore={loadMore}
                            onCharge={chargeCycle}
                            onSkip={skipCycle}
                            onUnskip={unskipCycle}
                            onReschedule={rescheduleCycle}
                        />

                        {isPrepaid && (
                            <FulfillmentCard
                                summary={fulfillmentSummary}
                                fulfillments={fulfillments}
                                loading={fulfillmentLoading}
                                actionLoading={fulfillmentActionLoading}
                                error={fulfillmentError}
                                actionsDisabled={billingActionsDisabled}
                                onReschedule={rescheduleFulfillment}
                                onSkip={skipFulfillment}
                                onRefund={refundFulfillment}
                            />
                        )}

                        <SubscriptionActivityLog logs={subscription.activity_logs ?? []} />

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
                        <CustomerCard
                            customer={subscription.customer}
                            subscriptionId={id}
                            onSynced={setCustomer}
                        />

                        <ShippingAddressCard
                            shipping={subscription.shipping}
                            customerAdminUrl={
                                subscription.customer?.admin_url ||
                                subscription.shipping?.customer_admin_url ||
                                subscription.payment_method?.customer_admin_url
                            }
                            onSelectDifferent={openSelectAddressModal}
                            onManageCustomer={handleManageCustomerAddresses}
                            onEditManually={openEditAddressModal}
                        />

                        <PaymentMethodCard
                            paymentMethod={subscription.payment_method}
                            sendingUpdate={sendingPaymentUpdate}
                            onSendUpdateLink={handleSendPaymentUpdate}
                            onManageCustomer={handleManageCustomerPayment}
                            onSwap={openSwapPaymentModal}
                        />

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Discounts</h3>
                            </div>
                            <div className="subscription-card__body">
                                <p className="subscription-address-line">
                                    {(subscription.discounts ?? []).length > 0
                                        ? `${subscription.discounts.length} discount(s) applied. Manage them in Items.`
                                        : "No discounts applied yet."}
                                </p>
                                <s-button onClick={openDiscountModal}>Add a discount</s-button>
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
                {discountModal}
                {swapPaymentModal}
                {selectAddressModal}
                {editAddressModal}
                {cancelModal}
            </s-page>
        </div>
    );
}
