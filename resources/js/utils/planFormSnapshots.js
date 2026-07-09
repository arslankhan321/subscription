function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeProducts(products = []) {
    return products.map((product) => ({
        id: product.id,
        variantId: product.variantId ?? null,
        title: product.title ?? "",
        productTitle: product.productTitle ?? null,
        variantTitle: product.variantTitle ?? null,
        image: product.image ?? null,
    }));
}

function normalizeDeliveryOptions(options = []) {
    return options.map(({ collapsed: _collapsed, ...option }) => clone(option));
}

export function buildAutoChargeSnapshot({
    planName,
    products,
    deliveryOptions,
}) {
    return {
        planName: planName ?? "",
        products: normalizeProducts(products),
        deliveryOptions: normalizeDeliveryOptions(deliveryOptions),
    };
}

export function buildRecurringInvoiceSnapshot({
    planName,
    products,
    intervalUnit,
    intervalOptions,
    subscriptionEmailHour,
    giveDiscount,
    discountAmount,
    discountDescription,
}) {
    return {
        planName: planName ?? "",
        products: normalizeProducts(products),
        intervalUnit: intervalUnit ?? "days",
        intervalOptions: clone(intervalOptions ?? []),
        subscriptionEmailHour: subscriptionEmailHour ?? "same_as_order",
        giveDiscount: Boolean(giveDiscount),
        discountAmount: discountAmount ?? "",
        discountDescription: discountDescription ?? "",
    };
}

export function snapshotsEqual(left, right) {
    if (!left || !right) return false;
    return JSON.stringify(left) === JSON.stringify(right);
}
