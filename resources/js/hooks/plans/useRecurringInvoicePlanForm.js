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
} from "@/constants/planConstants";
import {
    buildRecurringInvoicePayload,
    createIntervalOption,
    mapRecurringInvoiceFromApi,
} from "@/utils/planHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import { buildProductSummary } from "@/utils/productHelpers";
import { validateRecurringInvoiceForm } from "@/utils/planValidation";
import { useFormValidation } from "./useFormValidation";
import { useProductPicker } from "./useProductPicker";
import { useRecurringInvoiceDirtyState } from "./usePlanFormDirtyState";

export const RECURRING_INVOICE_SAVE_BAR_ID = "plan-recurring-invoice-save-bar";

export function useRecurringInvoicePlanForm({ planId = null, onSuccess }) {
    const isEdit = Boolean(planId);

    const [planName, setPlanName] = useState(DEFAULT_PLAN_NAME);
    const [widget, setWidget] = useState(DEFAULT_WIDGET);
    const [planStatus, setPlanStatus] = useState(PLAN_STATUS.DRAFT);
    const [planPublished, setPlanPublished] = useState(false);
    const [intervalUnit, setIntervalUnit] = useState("days");
    const [intervalOptions, setIntervalOptions] = useState([createIntervalOption("30")]);
    const [subscriptionEmailHour, setSubscriptionEmailHour] = useState("same_as_order");
    const [giveDiscount, setGiveDiscount] = useState(true);
    const [discountAmount, setDiscountAmount] = useState("10");
    const [discountDescription, setDiscountDescription] = useState(
        "You will get a 10% discount on every recurring order."
    );
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEdit);

    const { products, setProducts, removeProduct, removeProductGroup, handleSelectProducts } = useProductPicker();

    const {
        validationErrors,
        fieldErrors,
        intervalOptionErrors,
        applyValidation,
        clearValidation,
        clearFieldError,
    } = useFormValidation();

    const { isDirty, baseline, setBaselineFromCurrent, setBaselineFromData } =
        useRecurringInvoiceDirtyState({
            isEdit,
            initialLoading,
            planName,
            widget,
            products,
            intervalUnit,
            intervalOptions,
            subscriptionEmailHour,
            giveDiscount,
            discountAmount,
            discountDescription,
        });

    useEffect(() => {
        if (!planId) return;

        let cancelled = false;

        async function loadPlan() {
            try {
                setInitialLoading(true);
                const response = await getPlan(planId);
                const formData = mapRecurringInvoiceFromApi(response.data?.data);

                if (cancelled || !formData) return;

                setPlanName(formData.planName);
                setWidget(formData.widget);
                setPlanStatus(formData.status);
                setPlanPublished(formData.published);
                setProducts(formData.products);
                setIntervalUnit(formData.intervalUnit);
                setIntervalOptions(
                    formData.intervalOptions?.length
                        ? formData.intervalOptions
                        : [createIntervalOption("30")]
                );
                setSubscriptionEmailHour(formData.subscriptionEmailHour);
                setGiveDiscount(formData.giveDiscount);
                setDiscountAmount(formData.discountAmount);
                setDiscountDescription(formData.discountDescription);
                setBaselineFromData(formData);
            } catch (error) {
                console.error(error);
                showToast(getApiErrorMessage(error, "Unable to load plan"), { isError: true });
            } finally {
                if (!cancelled) setInitialLoading(false);
            }
        }

        loadPlan();

        return () => {
            cancelled = true;
        };
    }, [planId, setProducts, setBaselineFromData]);

    const summary = useMemo(
        () => ({
            widget,
            optionCount: intervalOptions.length,
            ...buildProductSummary(products),
            status: planStatus,
            planType: "recurring_invoice",
        }),
        [widget, intervalOptions.length, products, planStatus]
    );

    const addInterval = useCallback(() => {
        setIntervalOptions((prev) => [...prev, createIntervalOption("30")]);
    }, []);

    const updateInterval = useCallback((id, frequency) => {
        setIntervalOptions((prev) =>
            prev.map((item) => (item.id === id ? { ...item, frequency } : item))
        );
    }, []);

    const removeInterval = useCallback((id) => {
        setIntervalOptions((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const submitPlan = useCallback(
        async ({ status, published }) => {
            const validationResult = validateRecurringInvoiceForm({
                planName,
                widget,
                products,
                intervalOptions,
                giveDiscount,
                discountAmount,
                discountDescription,
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

            const payload = buildRecurringInvoicePayload({
                planName,
                widget,
                products,
                intervalUnit,
                intervalOptions,
                subscriptionEmailHour,
                giveDiscount,
                discountAmount,
                discountDescription,
                status,
                published,
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
        [
            planName,
            widget,
            products,
            intervalUnit,
            intervalOptions,
            subscriptionEmailHour,
            giveDiscount,
            discountAmount,
            discountDescription,
            isEdit,
            planId,
            onSuccess,
            setBaselineFromCurrent,
            applyValidation,
            clearValidation,
        ]
    );

    const handleDiscard = useCallback(() => {
        if (!baseline) return;

        setPlanName(baseline.planName);
        setWidget(baseline.widget);
        setProducts(baseline.products.map((product) => ({ ...product })));
        setIntervalUnit(baseline.intervalUnit);
        setIntervalOptions(baseline.intervalOptions.map((option) => ({ ...option })));
        setSubscriptionEmailHour(baseline.subscriptionEmailHour);
        setGiveDiscount(baseline.giveDiscount);
        setDiscountAmount(baseline.discountAmount);
        setDiscountDescription(baseline.discountDescription);
        clearValidation();
    }, [baseline, setProducts, clearValidation]);

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
        saveBarId: RECURRING_INVOICE_SAVE_BAR_ID,
        validationErrors,
        fieldErrors,
        intervalOptionErrors,
        clearFieldError,
        planName,
        setPlanName,
        widget,
        setWidget,
        planStatus,
        products,
        removeProduct,
        removeProductGroup,
        handleSelectProducts,
        intervalUnit,
        setIntervalUnit,
        intervalOptions,
        addInterval,
        updateInterval,
        removeInterval,
        subscriptionEmailHour,
        setSubscriptionEmailHour,
        giveDiscount,
        setGiveDiscount,
        discountAmount,
        setDiscountAmount,
        discountDescription,
        setDiscountDescription,
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
