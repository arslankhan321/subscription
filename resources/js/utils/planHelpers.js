import { BILLING_TYPES } from "@/constants/planConstants";
import {
    validatePlanForm,
    validateRecurringInvoiceFormErrors as validateRecurringInvoiceForm,
} from "@/utils/planValidation";

export { validatePlanForm, validateRecurringInvoiceForm };

let optionIdCounter = 1;

export function createDeliveryOption(overrides = {}) {
    return {
        id: optionIdCounter++,
        name: "",
        billingType: BILLING_TYPES.PAY_AS_YOU_GO,
        deliveryFrequency: "1",
        deliveryInterval: "months",
        billingFrequency: "1",
        billingInterval: "months",
        minOrders: "Disabled",
        maxOrders: "Unlimited",
        giveDiscount: true,
        discountAmount: "10",
        discountType: "Percentage off",
        changeDiscountAfterOrders: false,
        laterDiscountAmount: "0",
        laterDiscountAfterOrders: "1",
        laterDiscountType: "Percentage off",
        giveShippingDiscount: false,
        shippingDiscountAmount: "0",
        shippingDiscountAfterOrders: "1",
        shippingDiscountType: "Fixed price",
        collapsed: false,
        ...overrides,
    };
}

export function getBillingFrequencyOptions(deliveryFrequency) {
    const freq = parseInt(deliveryFrequency || 1, 10);

    return Array.from({ length: 12 }, (_, i) => ({
        value: String(freq * (i + 1)),
        label: `Every ${freq * (i + 1)}`,
    }));
}

export function buildPlanPayload({ planName, products, deliveryOptions, status, published, planType }) {
    return {
        name: planName.trim(),
        planType: planType ?? "auto_charge",
        status,
        published,
        merchant_code: null,
        products: products.map((product) => ({
            id: product.id,
            variantId: product.variantId ?? null,
            title: product.title,
            image: product.image,
        })),
        deliveryOptions: deliveryOptions.map((option) => ({
            name: option.name || null,
            billingType: option.billingType,
            deliveryFrequency: Number(option.deliveryFrequency),
            deliveryInterval: option.deliveryInterval,
            billingFrequency:
                option.billingType === BILLING_TYPES.PREPAID
                    ? Number(option.billingFrequency)
                    : null,
            billingInterval:
                option.billingType === BILLING_TYPES.PREPAID
                    ? option.billingInterval
                    : null,
            minOrders: option.minOrders,
            maxOrders: option.maxOrders,
            giveDiscount: option.giveDiscount,
            discountAmount: option.discountAmount,
            discountType: option.discountType,
            changeDiscountAfterOrders: option.changeDiscountAfterOrders,
            laterDiscountAmount: option.laterDiscountAmount,
            laterDiscountAfterOrders: option.laterDiscountAfterOrders,
            laterDiscountType: option.laterDiscountType,
            giveShippingDiscount: option.giveShippingDiscount,
            shippingDiscountAmount: option.shippingDiscountAmount,
            shippingDiscountAfterOrders: option.shippingDiscountAfterOrders,
            shippingDiscountType: option.shippingDiscountType,
        })),
    };
}

export function formatPlanStatus(status) {
    if (!status) return "Draft";
    return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getStatusTone(status) {
    if (status === "active") return "success";
    if (status === "draft") return "warning";
    return "critical";
}

export function mapPlanFromApi(plan) {
    if (!plan) {
        return null;
    }

    return {
        planName: plan.name ?? "",
        status: plan.status ?? "draft",
        published: Boolean(plan.published),
        planType: plan.plan_type ?? "auto_charge",
        subscriptionEmailHour: plan.subscription_email_hour ?? "same_as_order",
        discountDescription: plan.discount_description ?? "",
        products: (plan.products ?? []).map((product) => ({
            id: product.shopify_product_id,
            variantId: product.shopify_variant_id ?? null,
            title: product.title ?? "Untitled product",
            image: product.image ?? null,
        })),
        deliveryOptions: (plan.options ?? []).length
            ? (plan.options ?? []).map((option) =>
                  createDeliveryOption({
                      name: option.name ?? "",
                      billingType: option.billing_type,
                      deliveryFrequency: String(option.delivery_frequency ?? 1),
                      deliveryInterval: option.delivery_interval ?? "months",
                      billingFrequency: option.billing_frequency
                          ? String(option.billing_frequency)
                          : String(option.delivery_frequency ?? 1),
                      billingInterval: option.billing_interval ?? option.delivery_interval ?? "months",
                      minOrders: option.min_orders ?? "Disabled",
                      maxOrders: option.max_orders ?? "Unlimited",
                      giveDiscount: Boolean(option.give_discount),
                      discountAmount: String(option.discount_amount ?? 0),
                      discountType: option.discount_type ?? "Percentage off",
                      changeDiscountAfterOrders: Boolean(option.change_discount_after_orders),
                      laterDiscountAmount: String(option.later_discount_amount ?? 0),
                      laterDiscountAfterOrders: String(option.later_discount_after_orders ?? 1),
                      laterDiscountType: option.later_discount_type ?? "Percentage off",
                      giveShippingDiscount: Boolean(option.give_shipping_discount),
                      shippingDiscountAmount: String(option.shipping_discount_amount ?? 0),
                      shippingDiscountAfterOrders: String(option.shipping_discount_after_orders ?? 1),
                      shippingDiscountType: option.shipping_discount_type ?? "Fixed price",
                  })
              )
            : [createDeliveryOption()],
    };
}

let intervalOptionIdCounter = 1;

export function createIntervalOption(frequency = "30") {
    return {
        id: intervalOptionIdCounter++,
        frequency: String(frequency),
    };
}

export function buildRecurringInvoiceDeliveryOptions({
    intervalUnit,
    intervalOptions,
    giveDiscount,
    discountAmount,
}) {
    return intervalOptions.map((option) => ({
        name: `${option.frequency} ${intervalUnit}`,
        billingType: "Recurring invoice",
        deliveryFrequency: Number(option.frequency),
        deliveryInterval: intervalUnit,
        billingFrequency: null,
        billingInterval: null,
        minOrders: "Disabled",
        maxOrders: "Unlimited",
        giveDiscount,
        discountAmount: String(discountAmount),
        discountType: "Percentage off",
        changeDiscountAfterOrders: false,
        laterDiscountAmount: "0",
        laterDiscountAfterOrders: "1",
        laterDiscountType: "Percentage off",
        giveShippingDiscount: false,
        shippingDiscountAmount: "0",
        shippingDiscountAfterOrders: "1",
        shippingDiscountType: "Fixed price",
    }));
}

export function buildRecurringInvoicePayload({
    planName,
    products,
    intervalUnit,
    intervalOptions,
    subscriptionEmailHour,
    giveDiscount,
    discountAmount,
    discountDescription,
    status,
    published,
}) {
    return {
        name: planName.trim(),
        planType: "recurring_invoice",
        subscriptionEmailHour,
        discountDescription,
        status,
        published,
        merchant_code: null,
        products: products.map((product) => ({
            id: product.id,
            variantId: product.variantId ?? null,
            title: product.title,
            image: product.image,
        })),
        deliveryOptions: buildRecurringInvoiceDeliveryOptions({
            intervalUnit,
            intervalOptions,
            giveDiscount,
            discountAmount,
        }),
    };
}

export function mapRecurringInvoiceFromApi(plan) {
    const base = mapPlanFromApi(plan);
    if (!base) return null;

    const firstOption = plan.options?.[0];

    return {
        ...base,
        planType: plan.plan_type ?? "recurring_invoice",
        subscriptionEmailHour: plan.subscription_email_hour ?? "same_as_order",
        discountDescription: plan.discount_description ?? "",
        intervalUnit: firstOption?.delivery_interval ?? "days",
        intervalOptions: (plan.options ?? []).map((option) =>
            createIntervalOption(String(option.delivery_frequency ?? 1))
        ),
        giveDiscount: Boolean(firstOption?.give_discount ?? true),
        discountAmount: String(firstOption?.discount_amount ?? 10),
    };
}

export function getPlanTypeLabel(planType) {
    if (planType === "recurring_invoice") return "Recurring invoice";
    return "Auto-charging";
}
