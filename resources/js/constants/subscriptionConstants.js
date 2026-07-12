export const SUBSCRIPTION_STATUS_TABS = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming subscriptions" },
    { id: "failed", label: "With failed payment" },
    { id: "pending_payment", label: "With pending payment" },
    { id: "active", label: "Active" },
    { id: "paused", label: "Paused" },
    { id: "cancelled", label: "Cancelled" },
];

export function buildShopifyPath(path) {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop") || window.shopDomain;
    const host = params.get("host") || window.app_host;

    return `${path}?shop=${shop}&host=${host}`;
}
