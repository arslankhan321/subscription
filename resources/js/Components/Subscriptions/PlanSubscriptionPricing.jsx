import { formatPlanDiscountBadge } from "@/utils/subscriptionHelpers";

function formatPlainMoney(amount, currencyCode = "USD") {
    const value = Number(amount || 0);
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${currencyCode} ${formatted}`;
}

function formatCycleOrdinal(count) {
    const n = Math.max(1, Number(count) || 1);
    const mod100 = n % 100;
    const mod10 = n % 10;

    if (mod100 >= 11 && mod100 <= 13) {
        return `${n}th`;
    }

    if (mod10 === 1) {
        return `${n}st`;
    }

    if (mod10 === 2) {
        return `${n}nd`;
    }

    if (mod10 === 3) {
        return `${n}rd`;
    }

    return `${n}th`;
}

function PricingRow({ label, price, basePrice, badge, showCompare = false }) {
    return (
        <div className="subscription-pricing-row">
            <span className="subscription-pricing-row__label">{label}</span>
            <span className="subscription-pricing-row__price">{price}</span>
            {showCompare ? (
                <span className="subscription-pricing-row__compare">{basePrice}</span>
            ) : (
                <span className="subscription-pricing-row__compare" />
            )}
            {badge ? <span className="subscription-pricing-row__badge">{badge}</span> : null}
        </div>
    );
}

export function PlanSubscriptionPricing({ planDiscount, currencyCode = "USD" }) {
    if (!planDiscount?.change_discount_after_orders) {
        return null;
    }

    const giveDiscount = Boolean(planDiscount.give_discount);
    const baseAmount = Number(planDiscount.base_price || 0);
    const firstAmount = Number(planDiscount.first_price || 0);
    const recurringAmount = Number(planDiscount.recurring_price || 0);
    const basePrice = formatPlainMoney(baseAmount, currencyCode);
    const firstPrice = formatPlainMoney(firstAmount, currencyCode);
    const recurringPrice = formatPlainMoney(recurringAmount, currencyCode);
    const afterOrders = planDiscount.later_discount_after_orders || 1;
    const showInitialCompare = giveDiscount && baseAmount > firstAmount + 0.0001;
    const showRecurringCompare = baseAmount > recurringAmount + 0.0001;

    return (
        <div className="subscription-pricing">
            <p className="subscription-pricing__title">Subscription Pricing:</p>
            <div className="subscription-pricing__box">
                <PricingRow
                    label="Initial price –"
                    price={firstPrice}
                    basePrice={basePrice}
                    showCompare={showInitialCompare}
                    badge={
                        giveDiscount
                            ? `${formatPlanDiscountBadge(
                                  planDiscount.discount_amount,
                                  planDiscount.discount_type
                              )} off`
                            : null
                    }
                />
                <PricingRow
                    label={`After ${formatCycleOrdinal(afterOrders)} cycle –`}
                    price={recurringPrice}
                    basePrice={basePrice}
                    showCompare={showRecurringCompare}
                    badge={`${formatPlanDiscountBadge(
                        planDiscount.later_discount_amount,
                        planDiscount.later_discount_type
                    )} off`}
                />
            </div>
        </div>
    );
}
