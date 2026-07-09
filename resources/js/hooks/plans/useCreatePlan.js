import { useCallback, useMemo, useState } from "react";
import { createPlan as createPlanApi } from "@/Services/planService";
import {
    DEFAULT_PLAN_NAME,
    PLAN_STATUS,
} from "@/constants/planConstants";
import { buildPlanPayload } from "@/utils/planHelpers";
import { validateAutoChargeForm } from "@/utils/planValidation";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import { buildProductSummary } from "@/utils/productHelpers";
import { useDeliveryOptions } from "./useDeliveryOptions";
import { useProductPicker } from "./useProductPicker";

export function useCreatePlan({ onSuccess }) {
    const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME);
    const [loading, setLoading] = useState(false);

    const { products, removeProduct, removeProductGroup, handleSelectProducts } = useProductPicker();
    const {
        deliveryOptions,
        updateOption,
        toggleCollapsed,
        addOption,
        duplicateOption,
        removeOption,
    } = useDeliveryOptions();

    const summary = useMemo(
        () => ({
            optionCount: deliveryOptions.length,
            ...buildProductSummary(products),
        }),
        [deliveryOptions.length, products]
    );

    const submitPlan = useCallback(
        async ({ published = false } = {}) => {
            const validationResult = validateAutoChargeForm({
                planName,
                products,
                deliveryOptions,
            });

            if (validationResult.errors.length) {
                showToast(validationResult.errors[0], { isError: true });
                return;
            }

            const payload = buildPlanPayload({
                planName,
                products,
                deliveryOptions,
                status: published ? PLAN_STATUS.ACTIVE : PLAN_STATUS.DRAFT,
                published,
            });

            try {
                setLoading(true);
                const response = await createPlanApi(payload);
                showToast(response.data.message || "Plan saved successfully");
                onSuccess?.(response.data.data);
            } catch (error) {
                console.error(error);
                showToast(getApiErrorMessage(error, "Unable to create plan"), {
                    isError: true,
                });
            } finally {
                setLoading(false);
            }
        },
        [planName, products, deliveryOptions, onSuccess]
    );

    const handleSaveDraft = useCallback(() => submitPlan({ published: false }), [submitPlan]);
    const handlePublish = useCallback(() => submitPlan({ published: true }), [submitPlan]);

    return {
        planName,
        setPlanName,
        products,
        removeProduct,
        removeProductGroup,
        handleSelectProducts,
        deliveryOptions,
        updateOption,
        toggleCollapsed,
        addOption,
        duplicateOption,
        removeOption,
        loading,
        summary,
        handleSaveDraft,
        handlePublish,
    };
}
