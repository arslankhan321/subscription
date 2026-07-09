import { useCallback, useEffect, useMemo, useState } from "react";
import {
    createPlan as createPlanApi,
    getPlan,
    updatePlan as updatePlanApi,
} from "@/Services/planService";
import {
    DEFAULT_PLAN_NAME,
    PLAN_STATUS,
    PLAN_TYPES,
} from "@/constants/planConstants";
import { buildPlanPayload, mapPlanFromApi } from "@/utils/planHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import { buildProductSummary } from "@/utils/productHelpers";
import { validateAutoChargeForm } from "@/utils/planValidation";
import { useDeliveryOptions } from "./useDeliveryOptions";
import { useFormValidation } from "./useFormValidation";
import { useProductPicker } from "./useProductPicker";
import { useAutoChargeDirtyState } from "./usePlanFormDirtyState";

export const AUTO_CHARGE_SAVE_BAR_ID = "plan-auto-charge-save-bar";

export function usePlanForm({ planId = null, onSuccess }) {
    const isEdit = Boolean(planId);

    const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME);
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

    const {
        validationErrors,
        fieldErrors,
        deliveryOptionErrors,
        applyValidation,
        clearValidation,
        clearFieldError,
    } = useFormValidation();

    const { isDirty, baseline, setBaselineFromCurrent, setBaselineFromData } =
        useAutoChargeDirtyState({
            isEdit,
            initialLoading,
            planName,
            products,
            deliveryOptions,
        });

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
                setPlanStatus(formData.status);
                setPlanPublished(formData.published);
                setProducts(formData.products);
                resetOptions(formData.deliveryOptions);
                setBaselineFromData(formData);
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
    }, [planId, resetOptions, setProducts, setBaselineFromData]);

    const summary = useMemo(
        () => ({
            optionCount: deliveryOptions.length,
            ...buildProductSummary(products),
            status: planStatus,
        }),
        [deliveryOptions.length, products, planStatus]
    );

    const submitPlan = useCallback(
        async ({ status, published }) => {
            const validationResult = validateAutoChargeForm({
                planName,
                products,
                deliveryOptions,
            });
            const isValid = applyValidation(validationResult);

            if (!isValid) {
                showToast(validationResult.errors[0] || "Please fix the highlighted fields.", {
                    isError: true,
                });
                document
                    .getElementById("plan-validation-banner")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
            }

            const payload = buildPlanPayload({
                planName,
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
                setBaselineFromCurrent();
                clearValidation();
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
        [planName, products, deliveryOptions, isEdit, planId, onSuccess, setBaselineFromCurrent, applyValidation, clearValidation]
    );

    const handleDiscard = useCallback(() => {
        if (!baseline) return;

        setPlanName(baseline.planName);
        setProducts(baseline.products.map((product) => ({ ...product })));
        resetOptions(baseline.deliveryOptions.map((option) => ({ ...option })));
        clearValidation();
    }, [baseline, resetOptions, setProducts, clearValidation]);

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

    const handleSaveFromBar = useCallback(() => {
        if (isEdit) {
            handleSaveChanges();
            return;
        }

        handleSaveDraft();
    }, [isEdit, handleSaveChanges, handleSaveDraft]);

    return {
        isEdit,
        isDirty,
        saveBarId: AUTO_CHARGE_SAVE_BAR_ID,
        validationErrors,
        fieldErrors,
        deliveryOptionErrors,
        clearFieldError,
        planName,
        setPlanName,
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
        handleSaveFromBar,
        handleDiscard,
    };
}

/** @deprecated Use usePlanForm instead */
export function useCreatePlan(options) {
    return usePlanForm(options);
}
