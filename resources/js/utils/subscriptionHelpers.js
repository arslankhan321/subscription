import { buildShopifyPath } from "@/constants/subscriptionConstants";

export function formatSubscriptionStatus(status) {
    if (!status) {
        return "Unknown";
    }

    return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getSubscriptionStatusTone(status) {
    switch ((status || "").toLowerCase()) {
        case "active":
            return "success";
        case "paused":
            return "warning";
        case "cancelled":
        case "expired":
            return "critical";
        case "failed":
            return "critical";
        default:
            return "info";
    }
}

export function getBillingCycleStatusTone(status) {
    switch ((status || "").toUpperCase()) {
        case "BILLED":
        case "COMPLETED":
            return "success";
        case "UNBILLED":
        case "SCHEDULED":
            return "info";
        case "SKIPPED":
            return "warning";
        default:
            return "neutral";
    }
}

export function formatMoney(amount, currencyCode = "USD") {
    const value = Number(amount || 0);

    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currencyCode} ${value.toFixed(2)}`;
    }
}

export function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatCustomerName(customer) {
    if (!customer) {
        return "Unknown customer";
    }

    const name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

    return name || customer.email || "Unknown customer";
}

export function formatShippingAddress(shipping) {
    if (!shipping) {
        return null;
    }

    return [
        [shipping.first_name, shipping.last_name].filter(Boolean).join(" "),
        shipping.company,
        shipping.address1,
        shipping.address2,
        [shipping.city, shipping.province || shipping.province_code, shipping.zip]
            .filter(Boolean)
            .join(" "),
        shipping.country,
        shipping.phone,
    ].filter(Boolean);
}

export function formatPaymentMethod(paymentMethod) {
    if (!paymentMethod) {
        return "No payment method on file";
    }

    if (paymentMethod.paypal_email) {
        return `PayPal (${paymentMethod.paypal_email})`;
    }

    const brand = paymentMethod.brand || "Card";
    const digits = paymentMethod.last_digits || paymentMethod.masked_number?.slice(-4);

    if (digits) {
        return `${brand} ending in ${digits}`;
    }

    return brand;
}

export function discountAppliesToProduct(discount, product) {
    if (!discount || !product) {
        return false;
    }

    if (discount.applies_to_all) {
        return true;
    }

    const lineId = product.shopify_line_id;
    if (!lineId) {
        return false;
    }

    return (discount.lines || []).some((line) => line.id === lineId);
}

export function getApplicableDiscounts(product, discounts = []) {
    return (discounts || []).filter((discount) => discountAppliesToProduct(discount, product));
}

export function calculateProductDiscountedTotal(product, discounts = []) {
    const quantity = Number(product?.quantity || 1);
    const unitPrice = Number(product?.current_price || 0);
    let total = unitPrice * quantity;
    const originalTotal = total;
    const applicable = getApplicableDiscounts(product, discounts);

    applicable.forEach((discount) => {
        if (discount.percentage != null) {
            total -= total * (Number(discount.percentage) / 100);
            return;
        }

        if (discount.fixed_amount != null) {
            total -= Number(discount.fixed_amount);
        }
    });

    total = Math.max(0, total);

    return {
        original_total: roundMoney(originalTotal),
        discounted_total: roundMoney(total),
        unit_price: roundMoney(unitPrice),
        discounted_unit_price: roundMoney(total / Math.max(1, quantity)),
        has_discount: applicable.length > 0 && total < originalTotal - 0.0001,
        savings: roundMoney(Math.max(0, originalTotal - total)),
        applicable_discounts: applicable,
    };
}

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function formatDiscountLabel(discount, currencyCode = "USD") {
    if (!discount) {
        return "Discount";
    }

    if (discount.percentage != null) {
        return `${discount.percentage}% off`;
    }

    if (discount.fixed_amount != null) {
        return `${formatMoney(discount.fixed_amount, discount.currency_code || currencyCode)} off`;
    }

    return "Discount";
}

export function formatPlanDiscountSummary(planDiscount, currencyCode = "USD") {
    if (!planDiscount) {
        return null;
    }

    const frequency = planDiscount.frequency_label || "delivery";
    const firstPrice = Number(planDiscount.first_price);
    const recurringPrice = Number(planDiscount.recurring_price);
    const giveDiscount = Boolean(planDiscount.give_discount);
    const changeAfter = Boolean(planDiscount.change_discount_after_orders);

    if (
        giveDiscount &&
        changeAfter &&
        Number.isFinite(firstPrice) &&
        Number.isFinite(recurringPrice) &&
        Math.abs(firstPrice - recurringPrice) > 0.0001
    ) {
        return `First payment ${formatMoney(firstPrice, currencyCode)}, then ${formatMoney(
            recurringPrice,
            currencyCode
        )} every ${frequency}`;
    }

    if (planDiscount.summary) {
        return planDiscount.summary;
    }

    if (giveDiscount) {
        return `${formatPlanDiscountBadge(
            planDiscount.discount_amount,
            planDiscount.discount_type
        )} off every ${frequency}`;
    }

    if (changeAfter) {
        return `After ${planDiscount.later_discount_after_orders || 1} order(s): ${formatPlanDiscountBadge(
            planDiscount.later_discount_amount,
            planDiscount.later_discount_type
        )} off every ${frequency}`;
    }

    return null;
}

export function formatPlanDiscountBadge(amount, type) {
    const value = Number(amount || 0);

    if (String(type || "")
        .toLowerCase()
        .includes("percentage")) {
        return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
    }

    return formatMoney(value);
}

export function goToSubscriptionCreate(navigate) {
    navigate(buildShopifyPath("/subscriptions/create"));
}

export function goToSubscriptionDetail(navigate, id) {
    navigate(buildShopifyPath(`/subscriptions/${id}`));
}

export function goToSubscriptionEdit(navigate, id) {
    navigate(buildShopifyPath(`/subscriptions/${id}/edit`));
}

export function goToSubscriptionsList(navigate) {
    navigate(buildShopifyPath("/subscriptions"));
}
