import { BILLING_TYPES, DELIVERY_INTERVALS } from "@/constants/planConstants";
import { getBillingFrequencyOptions } from "@/utils/planHelpers";

export function toShopifyGid(value, resource) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const raw = String(value).trim();
    const match = raw.match(new RegExp(`(?:gid://shopify/${resource}/)?(\\d+)$`, "i"));

    if (!match?.[1]) {
        return raw.startsWith("gid://") ? raw : null;
    }

    return `gid://shopify/${resource}/${match[1]}`;
}

export function shopifyIntervalToForm(interval) {
    const value = String(interval || "MONTH").toUpperCase();

    switch (value) {
        case "DAY":
        case "DAYS":
            return "days";
        case "WEEK":
        case "WEEKS":
            return "weeks";
        case "YEAR":
        case "YEARS":
            return "years";
        case "MONTH":
        case "MONTHS":
        default:
            return "months";
    }
}

export function detectBillingType(subscription) {
    const deliveryCount = Number(subscription?.delivery_interval_count || 1);
    const billingCount = Number(subscription?.billing_interval_count || deliveryCount);
    const deliveryInterval = shopifyIntervalToForm(subscription?.delivery_interval);
    const billingInterval = shopifyIntervalToForm(subscription?.billing_interval);

    if (
        billingCount !== deliveryCount ||
        billingInterval !== deliveryInterval
    ) {
        return BILLING_TYPES.PREPAID;
    }

    return BILLING_TYPES.PAY_AS_YOU_GO;
}

export function buildEditFormFromSubscription(subscription) {
    const deliveryFrequency = String(subscription?.delivery_interval_count || 1);
    const deliveryInterval = shopifyIntervalToForm(subscription?.delivery_interval);
    const billingType = detectBillingType(subscription);
    const billingFrequency = String(
        subscription?.billing_interval_count || deliveryFrequency
    );
    const billingInterval =
        billingType === BILLING_TYPES.PREPAID
            ? shopifyIntervalToForm(subscription?.billing_interval) || deliveryInterval
            : deliveryInterval;

    return {
        billingType,
        deliveryFrequency,
        deliveryInterval,
        billingFrequency,
        billingInterval,
        deliveryPrice: String(subscription?.delivery_price ?? 0),
        lines: (subscription?.products || []).map((product) => ({
            id: product.shopify_line_id,
            localId: product.id,
            title: product.title,
            variant_title: product.variant_title,
            image_url: product.image_url,
            product_variant_id: toShopifyGid(
                product.shopify_variant_id,
                "ProductVariant"
            ),
            selling_plan_id: toShopifyGid(product.shopify_selling_plan_id, "SellingPlan"),
            selling_plan_name: product.selling_plan_name || null,
            quantity: String(product.quantity || 1),
            current_price: String(product.current_price ?? 0),
            isNew: false,
            remove: false,
        })),
    };
}

export function mapPickerProductsToEditLines(selected, existingLines = []) {
    const existingVariantIds = new Set(
        existingLines
            .filter((line) => !line.remove)
            .map((line) => String(line.product_variant_id || ""))
            .filter(Boolean)
    );

    const defaultSellingPlan = existingLines.find(
        (line) => !line.remove && line.selling_plan_id
    );

    return selected.flatMap((product) => {
        const variants = product.variants?.length ? product.variants : [null];

        return variants
            .map((variant) => {
                const variantId = variant?.id || null;

                if (!variantId || existingVariantIds.has(String(variantId))) {
                    return null;
                }

                const variantTitle = variant?.displayName || variant?.title || null;
                const price =
                    variant?.price?.amount ??
                    variant?.price ??
                    product?.price ??
                    "0";

                return {
                    id: `new:${variantId}`,
                    localId: null,
                    title: product.title,
                    variant_title: variantTitle,
                    image_url:
                        variant?.image?.originalSrc ||
                        product.images?.[0]?.originalSrc ||
                        null,
                    product_variant_id: toShopifyGid(variantId, "ProductVariant"),
                    selling_plan_id: toShopifyGid(
                        defaultSellingPlan?.selling_plan_id,
                        "SellingPlan"
                    ),
                    selling_plan_name: defaultSellingPlan?.selling_plan_name || null,
                    quantity: "1",
                    current_price: String(price),
                    isNew: true,
                    remove: false,
                };
            })
            .filter(Boolean);
    });
}

export function validateEditSubscriptionForm(form) {
    const errors = {};

    const deliveryFrequency = Number(form.deliveryFrequency);
    if (!deliveryFrequency || deliveryFrequency < 1) {
        errors.deliveryFrequency = "Delivery frequency must be at least 1.";
    }

    if (!DELIVERY_INTERVALS.includes(form.deliveryInterval)) {
        errors.deliveryInterval = "Select a valid delivery interval.";
    }

    if (form.billingType === BILLING_TYPES.PREPAID) {
        const billingFrequency = Number(form.billingFrequency);

        if (!billingFrequency || billingFrequency < 1) {
            errors.billingFrequency = "Billing frequency is required for prepaid plans.";
        } else if (deliveryFrequency >= 1 && billingFrequency % deliveryFrequency !== 0) {
            errors.billingFrequency =
                "Billing frequency must be a multiple of delivery frequency.";
        }

        if (form.billingInterval !== form.deliveryInterval) {
            errors.billingInterval = "Billing interval must match delivery interval.";
        }
    }

    const activeLines = (form.lines || []).filter((line) => !line.remove);

    if (activeLines.length < 1) {
        errors.lines = "Keep at least one subscription product.";
    }

    activeLines.forEach((line, index) => {
        if (!Number(line.quantity) || Number(line.quantity) < 1) {
            errors[`lines.${index}.quantity`] = "Quantity must be at least 1.";
        }

        if (line.current_price === "" || Number(line.current_price) < 0) {
            errors[`lines.${index}.current_price`] = "Price must be 0 or greater.";
        }
    });

    if (form.deliveryPrice === "" || Number(form.deliveryPrice) < 0) {
        errors.deliveryPrice = "Delivery price must be 0 or greater.";
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}

export function buildEditSubscriptionPayload(form) {
    const isPrepaid = form.billingType === BILLING_TYPES.PREPAID;

    return {
        billing_type: form.billingType,
        delivery_frequency: Number(form.deliveryFrequency),
        delivery_interval: form.deliveryInterval,
        billing_frequency: isPrepaid ? Number(form.billingFrequency) : null,
        billing_interval: isPrepaid ? form.billingInterval : null,
        delivery_price: Number(form.deliveryPrice || 0),
        lines: (form.lines || []).map((line) => {
            if (line.isNew) {
                return {
                    add: true,
                    product_variant_id: toShopifyGid(
                        line.product_variant_id,
                        "ProductVariant"
                    ),
                    selling_plan_id: toShopifyGid(line.selling_plan_id, "SellingPlan"),
                    selling_plan_name: line.selling_plan_name || null,
                    quantity: Number(line.quantity),
                    current_price: Number(line.current_price),
                    remove: false,
                };
            }

            return {
                id: line.id,
                quantity: Number(line.quantity),
                current_price: Number(line.current_price),
                remove: Boolean(line.remove),
            };
        }),
    };
}

export function getPrepaidBillingFrequencyOptions(deliveryFrequency) {
    return getBillingFrequencyOptions(deliveryFrequency);
}

export function calculateEditSubtotal(form) {
    return (form.lines || [])
        .filter((line) => !line.remove)
        .reduce(
            (sum, line) => sum + Number(line.current_price || 0) * Number(line.quantity || 0),
            0
        );
}
