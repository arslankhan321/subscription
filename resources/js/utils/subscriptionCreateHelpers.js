import { BILLING_TYPES, DELIVERY_INTERVALS } from "@/constants/planConstants";
import {
    getPrepaidBillingFrequencyOptions,
    mapPickerProductsToEditLines,
    toShopifyGid,
} from "@/utils/subscriptionEditHelpers";

export function buildDefaultCreateForm(currencyCode = "USD") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const date = tomorrow.toISOString().slice(0, 10);
    const hours = String(tomorrow.getHours()).padStart(2, "0");
    const minutes = String(tomorrow.getMinutes()).padStart(2, "0");

    return {
        status: "PAUSED",
        nextOrderDate: date,
        nextOrderTime: `${hours}:${minutes}`,
        currencyCode,
        billingType: BILLING_TYPES.PREPAID,
        deliveryFrequency: "1",
        deliveryInterval: "months",
        billingFrequency: "1",
        billingInterval: "months",
        billingMinCycles: "",
        billingMaxCycles: "",
        deliveryPrice: "0",
        deliveryMethodTitle: "Subscription shipping",
        digitalProduct: false,
        customer: null,
        paymentMethodId: "",
        paymentMethods: [],
        lines: [],
        shipping: {
            first_name: "",
            last_name: "",
            company: "",
            address1: "",
            address2: "",
            city: "",
            province: "",
            province_code: "",
            country: "",
            country_code: "",
            zip: "",
            phone: "",
        },
    };
}

export function mapPickerProductsToCreateLines(selected, existingLines = []) {
    return mapPickerProductsToEditLines(selected, existingLines).map((line) => ({
        ...line,
        selling_plan_id: null,
        selling_plan_name: null,
    }));
}

export function buildCreateSubscriptionPayload(form) {
    const isPrepaid = form.billingType === BILLING_TYPES.PREPAID;
    const timeRaw = form.nextOrderTime || "10:00";
    const time = /^\d{2}:\d{2}$/.test(timeRaw) ? `${timeRaw}:00` : timeRaw;
    const nextBillingDate = `${form.nextOrderDate}T${time}`;

    return {
        customer_id: form.customer?.id,
        payment_method_id: form.paymentMethodId,
        currency_code: form.currencyCode,
        next_billing_date: nextBillingDate,
        status: form.status || "PAUSED",
        billing_type: form.billingType,
        delivery_frequency: Number(form.deliveryFrequency),
        delivery_interval: form.deliveryInterval,
        billing_frequency: isPrepaid ? Number(form.billingFrequency) : Number(form.deliveryFrequency),
        billing_interval: isPrepaid ? form.billingInterval : form.deliveryInterval,
        billing_min_cycles: form.billingMinCycles ? Number(form.billingMinCycles) : null,
        billing_max_cycles: form.billingMaxCycles ? Number(form.billingMaxCycles) : null,
        delivery_price: form.digitalProduct ? 0 : Number(form.deliveryPrice || 0),
        delivery_method_title: form.digitalProduct
            ? null
            : form.deliveryMethodTitle || "Subscription shipping",
        digital_product: Boolean(form.digitalProduct),
        shipping: form.digitalProduct
            ? null
            : {
                  first_name: form.shipping.first_name || form.customer?.first_name || "",
                  last_name: form.shipping.last_name || form.customer?.last_name || "",
                  company: form.shipping.company || "",
                  address1: form.shipping.address1 || "",
                  address2: form.shipping.address2 || "",
                  city: form.shipping.city || "",
                  province: form.shipping.province || "",
                  province_code: form.shipping.province_code || "",
                  country: form.shipping.country || "",
                  country_code: form.shipping.country_code || "",
                  zip: form.shipping.zip || "",
                  phone: form.shipping.phone || form.customer?.phone || "",
              },
        lines: (form.lines || [])
            .filter((line) => !line.remove)
            .map((line) => ({
                product_variant_id: toShopifyGid(line.product_variant_id, "ProductVariant"),
                quantity: Number(line.quantity || 1),
                current_price: Number(line.current_price || 0),
                selling_plan_id: line.selling_plan_id
                    ? toShopifyGid(line.selling_plan_id, "SellingPlan")
                    : null,
                selling_plan_name: line.selling_plan_name || null,
            })),
    };
}

export function validateCreateSubscriptionForm(form) {
    const errors = {};

    if (!form.customer?.id) {
        errors.customer = "Select a customer.";
    }

    if (!form.paymentMethodId) {
        errors.paymentMethodId = "Select a payment method for this customer.";
    }

    if (!form.nextOrderDate) {
        errors.nextOrderDate = "Next order date is required.";
    }

    if (!form.nextOrderTime) {
        errors.nextOrderTime = "Next order time is required.";
    }

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
            errors.billingFrequency = "Billing frequency is required for prepaid.";
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
        errors.lines = "Select at least one product.";
    }

    activeLines.forEach((line, index) => {
        if (!Number(line.quantity) || Number(line.quantity) < 1) {
            errors[`lines.${index}.quantity`] = "Quantity must be at least 1.";
        }

        if (line.current_price === "" || Number(line.current_price) < 0) {
            errors[`lines.${index}.current_price`] = "Price must be 0 or greater.";
        }
    });

    if (!form.digitalProduct) {
        if (form.deliveryPrice === "" || Number(form.deliveryPrice) < 0) {
            errors.deliveryPrice = "Delivery price must be 0 or greater.";
        }

        if (!form.shipping?.address1) {
            errors["shipping.address1"] = "Address is required.";
        }
        if (!form.shipping?.city) {
            errors["shipping.city"] = "City is required.";
        }
        if (!form.shipping?.country_code) {
            errors["shipping.country_code"] = "Country is required.";
        }
        if (!form.shipping?.zip) {
            errors["shipping.zip"] = "Zip is required.";
        }
        if (!form.shipping?.last_name && !form.customer?.last_name) {
            errors["shipping.last_name"] = "Last name is required.";
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}

export function calculateCreateSubtotal(form) {
    return (form?.lines || [])
        .filter((line) => !line.remove)
        .reduce(
            (sum, line) => sum + Number(line.quantity || 0) * Number(line.current_price || 0),
            0
        );
}

export { getPrepaidBillingFrequencyOptions };
