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
        [shipping.city, shipping.province_code || shipping.province, shipping.zip]
            .filter(Boolean)
            .join(", "),
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

export function goToSubscriptionDetail(navigate, id) {
    navigate(buildShopifyPath(`/subscriptions/${id}`));
}

export function goToSubscriptionsList(navigate) {
    navigate(buildShopifyPath("/subscriptions"));
}
