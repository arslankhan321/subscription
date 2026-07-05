import { BILLING_TYPES } from "@/constants/planConstants";

export function createValidationResult() {
    return {
        errors: [],
        fields: {},
        deliveryOptionErrors: [],
        intervalOptionErrors: [],
    };
}

function addFieldError(result, field, message) {
    if (!result.fields[field]) {
        result.fields[field] = message;
    }

    if (!result.errors.includes(message)) {
        result.errors.push(message);
    }
}

function validateCommonFields(result, { planName, widget, products }) {
    const trimmedName = planName?.trim() ?? "";

    if (!trimmedName) {
        addFieldError(result, "planName", "Plan name is required.");
    } else if (trimmedName.length > 255) {
        addFieldError(result, "planName", "Plan name must be 255 characters or less.");
    }

    if (!widget?.trim()) {
        addFieldError(result, "widget", "Widget assignment is required.");
    }

    if (!products?.length) {
        addFieldError(result, "products", "Select at least one product.");
    }
}

function validateDiscountAmount(result, {
    giveDiscount,
    discountAmount,
    fieldKey = "discountAmount",
    label = "Discount",
}) {
    if (!giveDiscount) {
        return;
    }

    const amount = Number(discountAmount);

    if (discountAmount === "" || discountAmount == null || Number.isNaN(amount)) {
        addFieldError(result, fieldKey, `${label} amount is required.`);
        return;
    }

    if (amount < 0 || amount > 100) {
        addFieldError(result, fieldKey, `${label} must be between 0 and 100.`);
    }
}

export function validateAutoChargeForm({ planName, widget, products, deliveryOptions }) {
    const result = createValidationResult();

    validateCommonFields(result, { planName, widget, products });

    if (!deliveryOptions?.length) {
        addFieldError(result, "deliveryOptions", "Add at least one delivery option.");
        return result;
    }

    deliveryOptions.forEach((option, index) => {
        const optionErrors = {};
        const trimmedName = option.name?.trim() ?? "";

        if (!trimmedName) {
            optionErrors.name = "Option name is required.";
            addFieldError(
                result,
                `deliveryOptions.${index}.name`,
                `Option #${index + 1}: name is required.`
            );
        } else if (trimmedName.length > 255) {
            optionErrors.name = "Option name must be 255 characters or less.";
            addFieldError(
                result,
                `deliveryOptions.${index}.name`,
                `Option #${index + 1}: name must be 255 characters or less.`
            );
        }

        const freq = Number(option.deliveryFrequency);

        if (!freq || freq < 1) {
            optionErrors.deliveryFrequency = "Delivery frequency must be at least 1.";
            addFieldError(
                result,
                `deliveryOptions.${index}.deliveryFrequency`,
                `Option #${index + 1}: delivery frequency must be at least 1.`
            );
        }

        if (option.billingType === BILLING_TYPES.PREPAID) {
            const billingFreq = Number(option.billingFrequency);
            if (!billingFreq || billingFreq < 1) {
                optionErrors.billingFrequency = "Billing frequency is required for prepaid plans.";
                addFieldError(
                    result,
                    `deliveryOptions.${index}.billingFrequency`,
                    `Option #${index + 1}: billing frequency is required for prepaid plans.`
                );
            }
        }

        if (option.giveDiscount) {
            const amount = Number(option.discountAmount);
            if (
                option.discountAmount === "" ||
                option.discountAmount == null ||
                Number.isNaN(amount)
            ) {
                optionErrors.discountAmount = "Discount amount is required.";
                addFieldError(
                    result,
                    `deliveryOptions.${index}.discountAmount`,
                    `Option #${index + 1}: discount amount is required.`
                );
            } else if (
                option.discountType === "Percentage off" &&
                (amount < 0 || amount > 100)
            ) {
                optionErrors.discountAmount = "Discount must be between 0 and 100.";
                addFieldError(
                    result,
                    `deliveryOptions.${index}.discountAmount`,
                    `Option #${index + 1}: discount must be between 0 and 100.`
                );
            } else if (amount < 0) {
                optionErrors.discountAmount = "Discount cannot be negative.";
                addFieldError(
                    result,
                    `deliveryOptions.${index}.discountAmount`,
                    `Option #${index + 1}: discount cannot be negative.`
                );
            }
        }

        result.deliveryOptionErrors[index] = optionErrors;
    });

    if (deliveryOptions.length > 0) {
        const seenNames = new Map();

        deliveryOptions.forEach((option, index) => {
            const trimmedName = option.name?.trim() ?? "";
            if (!trimmedName) return;

            const normalizedName = trimmedName.toLowerCase();
            if (seenNames.has(normalizedName)) {
                const message = `Option #${index + 1}: duplicate option name.`;
                result.deliveryOptionErrors[index] = {
                    ...result.deliveryOptionErrors[index],
                    name: "Each delivery option must have a unique name.",
                };
                addFieldError(result, `deliveryOptions.${index}.name`, message);

                const duplicateIndex = seenNames.get(normalizedName);
                result.deliveryOptionErrors[duplicateIndex] = {
                    ...result.deliveryOptionErrors[duplicateIndex],
                    name: "Each delivery option must have a unique name.",
                };
                addFieldError(
                    result,
                    `deliveryOptions.${duplicateIndex}.name`,
                    `Option #${duplicateIndex + 1}: duplicate option name.`
                );
            } else {
                seenNames.set(normalizedName, index);
            }
        });
    }

    return result;
}

export function validateRecurringInvoiceForm({
    planName,
    widget,
    products,
    intervalOptions,
    giveDiscount,
    discountAmount,
    discountDescription,
}) {
    const result = createValidationResult();

    validateCommonFields(result, { planName, widget, products });

    if (!intervalOptions?.length) {
        addFieldError(result, "intervalOptions", "Add at least one subscription interval.");
        return result;
    }

    const seenFrequencies = new Set();

    intervalOptions.forEach((option, index) => {
        const optionErrors = {};
        const freq = Number(option.frequency);

        if (!freq || freq < 1) {
            optionErrors.frequency = "Interval must be at least 1.";
            addFieldError(
                result,
                `intervalOptions.${index}.frequency`,
                `Interval #${index + 1}: frequency must be at least 1.`
            );
        } else if (seenFrequencies.has(freq)) {
            optionErrors.frequency = "Duplicate interval values are not allowed.";
            addFieldError(
                result,
                `intervalOptions.${index}.frequency`,
                `Interval #${index + 1}: duplicate interval value.`
            );
        } else {
            seenFrequencies.add(freq);
        }

        result.intervalOptionErrors[index] = optionErrors;
    });

    validateDiscountAmount(result, {
        giveDiscount,
        discountAmount,
        fieldKey: "discountAmount",
        label: "Discount",
    });

    if (giveDiscount && !discountDescription?.trim()) {
        addFieldError(
            result,
            "discountDescription",
            "Discount description is required when a discount is enabled."
        );
    }

    return result;
}

export function validatePlanForm(formData) {
    return validateAutoChargeForm(formData).errors;
}

export function validateRecurringInvoiceFormErrors(formData) {
    return validateRecurringInvoiceForm(formData).errors;
}
