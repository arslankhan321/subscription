import { useCallback, useEffect, useMemo, useState } from "react";
import {
    createPlan as createPlanApi,
    getPlan,
    updatePlan as updatePlanApi,
} from "@/Services/planService";
import {
    DEFAULT_PLAN_NAME,
    DEFAULT_WIDGET,
    PLAN_STATUS,
    PLAN_TYPES,
} from "@/constants/planConstants";
import { buildPlanPayload, mapPlanFromApi, validatePlanForm } from "@/utils/planHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import { useDeliveryOptions } from "./useDeliveryOptions";
import { useProductPicker } from "./useProductPicker";

export function usePlanForm({ planId = null, onSuccess }) {
    const isEdit = Boolean(planId);

    const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME);
    const [widget, setWidget] = useState(DEFAULT_WIDGET);
    const [planStatus, setPlanStatus] = useState(PLAN_STATUS.DRAFT);
    const [planPublished, setPlanPublished] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEdit);

    const { products, setProducts, removeProduct, removeProductGroup, handleSelectProducts } = useProductPicker();
    const {
        deliveryOptions,
        updateOption,
        toggleCollapsed,
        addOption,
        duplicateOption,
        removeOption,
        resetOptions,
    } = useDeliveryOptions();

    useEffect(() => {
        if (!planId) {
            return;
        }

        let cancelled = false;

        async function loadPlan() {
            try {
                setInitialLoading(true);
                const response = await getPlan(planId);
                const formData = mapPlanFromApi(response.data?.data);

                if (cancelled || !formData) {
                    return;
                }

                setPlanName(formData.planName);
                setWidget(formData.widget);
                setPlanStatus(formData.status);
                setPlanPublished(formData.published);
                setProducts(formData.products);
                resetOptions(formData.deliveryOptions);
            } catch (error) {
                console.error(error);
                showToast(getApiErrorMessage(error, "Unable to load plan"), {
                    isError: true,
                });
            } finally {
                if (!cancelled) {
                    setInitialLoading(false);
                }
            }
        }

        loadPlan();

        return () => {
            cancelled = true;
        };
    }, [planId, resetOptions, setProducts]);

    const summary = useMemo(
        () => ({
            widget,
            optionCount: deliveryOptions.length,
            productNames: products.map((p) => p.title),
            status: planStatus,
        }),
        [widget, deliveryOptions.length, products, planStatus]
    );

    const submitPlan = useCallback(
        async ({ status, published }) => {
            const validationErrors = validatePlanForm({
                planName,
                products,
                deliveryOptions,
            });

            if (validationErrors.length) {
                showToast(validationErrors[0], { isError: true });
                return;
            }

            const payload = buildPlanPayload({
                planName,
                widget,
                products,
                deliveryOptions,
                status,
                published,
                planType: PLAN_TYPES.AUTO_CHARGE,
            });

            try {
                setLoading(true);

                const response = isEdit
                    ? await updatePlanApi(planId, payload)
                    : await createPlanApi(payload);

                setPlanStatus(status);
                setPlanPublished(published);

                showToast(
                    response.data.message ||
                        (isEdit ? "Plan updated successfully" : "Plan saved successfully")
                );
                onSuccess?.(response.data.data);
            } catch (error) {
                console.error(error);
                showToast(
                    getApiErrorMessage(
                        error,
                        isEdit ? "Unable to update plan" : "Unable to create plan"
                    ),
                    { isError: true }
                );
            } finally {
                setLoading(false);
            }
        },
        [planName, widget, products, deliveryOptions, isEdit, planId, onSuccess]
    );

    const handleSaveDraft = useCallback(
        () => submitPlan({ status: PLAN_STATUS.DRAFT, published: false }),
        [submitPlan]
    );

    const handlePublish = useCallback(
        () => submitPlan({ status: PLAN_STATUS.ACTIVE, published: true }),
        [submitPlan]
    );

    const handleSaveChanges = useCallback(
        () => submitPlan({ status: planStatus, published: planPublished }),
        [submitPlan, planStatus, planPublished]
    );

    return {
        isEdit,
        planName,
        setPlanName,
        widget,
        setWidget,
        planStatus,
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
        initialLoading,
        summary,
        handleSaveDraft,
        handlePublish,
        handleSaveChanges,
    };
}

/** @deprecated Use usePlanForm instead */
export function useCreatePlan(options) {
    return usePlanForm(options);
}
