import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
import { SubscriptionEditSkeleton } from "@/Components/Skeletons";
import { BILLING_TYPES, DELIVERY_INTERVALS } from "@/constants/planConstants";
import { useSubscriptionDetail } from "@/hooks/subscriptions/useSubscriptionDetail";
import { useShopifySaveBar } from "@/hooks/useShopifySaveBar";
import { updateSubscription } from "@/Services/subscriptionService";
import {
    buildEditFormFromSubscription,
    buildEditSubscriptionPayload,
    calculateEditSubtotal,
    getPrepaidBillingFrequencyOptions,
    mapPickerProductsToEditLines,
    validateEditSubscriptionForm,
} from "@/utils/subscriptionEditHelpers";
import {
    formatMoney,
    goToSubscriptionDetail,
    goToSubscriptionsList,
} from "@/utils/subscriptionHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/subscriptions.css";
import "@/styles/skeleton.css";

const SAVE_BAR_ID = "subscription-edit-save-bar";

function cloneForm(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
}

export default function SubscriptionEdit() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { subscription, loading, error } = useSubscriptionDetail(id);
    const [form, setForm] = useState(null);
    const [baseline, setBaseline] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (subscription) {
            const nextForm = buildEditFormFromSubscription(subscription);
            setForm(nextForm);
            setBaseline(cloneForm(nextForm));
            setFieldErrors({});
        }
    }, [subscription]);

    const isDirty = useMemo(() => {
        if (!form || !baseline) {
            return false;
        }

        return JSON.stringify(form) !== JSON.stringify(baseline);
    }, [form, baseline]);

    const { confirmLeave, hide: hideSaveBar } = useShopifySaveBar({
        id: SAVE_BAR_ID,
        isDirty,
        enabled: Boolean(form) && !loading,
    });

    const currency = subscription?.currency_code || "USD";
    const shippingTitle =
        subscription?.shipping?.shipping_option_title || "Shipping";

    const updateForm = useCallback((patch) => {
        setForm((prev) => {
            if (!prev) {
                return prev;
            }

            const next = { ...prev, ...patch };

            if (patch.billingType === BILLING_TYPES.PREPAID) {
                next.billingFrequency = prev.deliveryFrequency;
                next.billingInterval = prev.deliveryInterval;
            }

            if (
                prev.billingType === BILLING_TYPES.PREPAID ||
                next.billingType === BILLING_TYPES.PREPAID
            ) {
                if (patch.deliveryFrequency !== undefined) {
                    next.billingFrequency = patch.deliveryFrequency;
                }
                if (patch.deliveryInterval !== undefined) {
                    next.billingInterval = patch.deliveryInterval;
                }
            }

            return next;
        });
    }, []);

    const updateLine = useCallback((lineId, patch) => {
        setForm((prev) => {
            if (!prev) {
                return prev;
            }

            return {
                ...prev,
                lines: prev.lines.map((line) =>
                    line.id === lineId ? { ...line, ...patch } : line
                ),
            };
        });
    }, []);

    const removeLine = useCallback((lineId) => {
        setForm((prev) => {
            if (!prev) {
                return prev;
            }

            const activeCount = prev.lines.filter((line) => !line.remove).length;
            const target = prev.lines.find((line) => line.id === lineId);

            if (!target || target.remove) {
                return prev;
            }

            if (activeCount <= 1) {
                showToast("Keep at least one subscription product", { isError: true });
                return prev;
            }

            if (target.isNew) {
                return {
                    ...prev,
                    lines: prev.lines.filter((line) => line.id !== lineId),
                };
            }

            return {
                ...prev,
                lines: prev.lines.map((line) =>
                    line.id === lineId ? { ...line, remove: true } : line
                ),
            };
        });
    }, []);

    const handleAddLineItem = useCallback(async () => {
        if (!window.shopify?.resourcePicker) {
            showToast("Product picker is not available.", { isError: true });
            return;
        }

        try {
            const selected = await window.shopify.resourcePicker({
                type: "product",
                multiple: true,
                action: "select",
                filter: {
                    variants: true,
                },
            });

            if (!selected?.length) {
                return;
            }

            setForm((prev) => {
                if (!prev) {
                    return prev;
                }

                const newLines = mapPickerProductsToEditLines(selected, prev.lines);

                if (newLines.length === 0) {
                    showToast("Selected products are already on this subscription", {
                        isError: true,
                    });
                    return prev;
                }

                return {
                    ...prev,
                    lines: [...prev.lines, ...newLines],
                };
            });
        } catch (err) {
            if (err?.message !== "Error: The user cancelled the picker" && !err?.code) {
                showToast(getApiErrorMessage(err, "Unable to open product picker"), {
                    isError: true,
                });
            }
        }
    }, []);

    const subtotal = useMemo(() => (form ? calculateEditSubtotal(form) : 0), [form]);
    const deliveryPrice = Number(form?.deliveryPrice || 0);
    const total = subtotal + deliveryPrice;

    const billingFrequencyOptions = useMemo(
        () => getPrepaidBillingFrequencyOptions(form?.deliveryFrequency || 1),
        [form?.deliveryFrequency]
    );

    const handleDiscardChanges = useCallback(() => {
        if (!baseline) {
            return;
        }

        setForm(cloneForm(baseline));
        setFieldErrors({});
    }, [baseline]);

    const handleLeave = useCallback(async () => {
        await confirmLeave();
        hideSaveBar();
        goToSubscriptionDetail(navigate, id);
    }, [confirmLeave, hideSaveBar, navigate, id]);

    const handleSave = useCallback(async () => {
        if (!form || saving) {
            return;
        }

        const validation = validateEditSubscriptionForm(form);
        setFieldErrors(validation.errors || {});

        if (!validation.valid) {
            showToast(Object.values(validation.errors)[0] || "Fix the form errors", {
                isError: true,
            });
            return;
        }

        setSaving(true);

        try {
            const response = await updateSubscription(id, buildEditSubscriptionPayload(form));
            showToast(response.data?.message || "Subscription updated");
            hideSaveBar();
            goToSubscriptionDetail(navigate, id);
        } catch (err) {
            showToast(getApiErrorMessage(err, "Unable to update subscription"), {
                isError: true,
            });
        } finally {
            setSaving(false);
        }
    }, [form, saving, id, hideSaveBar, navigate]);

    if (loading || !form) {
        return (
            <div className="subscriptions-page">
                <s-page heading="Edit subscription">
                    <SubscriptionEditSkeleton />
                </s-page>
            </div>
        );
    }

    if (error || !subscription) {
        return (
            <div className="subscriptions-page">
                <s-page heading="Edit subscription">
                    <s-stack direction="block" gap="base">
                        <s-banner tone="critical">
                            {error || "Subscription not found"}
                        </s-banner>
                        <s-button onClick={() => goToSubscriptionsList(navigate)}>
                            Back to subscriptions
                        </s-button>
                    </s-stack>
                </s-page>
            </div>
        );
    }

    const activeLines = form.lines.filter((line) => !line.remove);

    return (
        <div className="subscriptions-page">
            <s-page heading={`Edit subscription ${subscription.reference}`}>
                <PlanSaveBar
                    id={SAVE_BAR_ID}
                    onSave={handleSave}
                    onDiscard={handleDiscardChanges}
                    saving={saving}
                    saveLabel="Save"
                />

                <s-button slot="secondary-action" onClick={handleLeave} disabled={saving}>
                    Back
                </s-button>
                <s-button
                    slot="primary-action"
                    variant="primary"
                    loading={saving}
                    disabled={saving || !isDirty}
                    onClick={handleSave}
                >
                    Save
                </s-button>

                <s-stack direction="block" gap="base">
                    <s-button variant="tertiary" onClick={handleLeave} disabled={saving}>
                        ← Back to subscription
                    </s-button>

                    <s-grid gridTemplateColumns="minmax(0, 1fr) 320px" gap="base">
                        <s-grid-item>
                            <s-stack direction="block" gap="base">
                                <s-section heading="Subscription details">
                                    <s-stack direction="block" gap="base">
                                        {activeLines.length === 0 ? (
                                            <s-banner tone="warning">
                                                No line items on this subscription.
                                            </s-banner>
                                        ) : (
                                            activeLines.map((line) => (
                                                <s-box
                                                    key={line.id}
                                                    padding="base"
                                                    border="base"
                                                    borderRadius="base"
                                                    background="base"
                                                >
                                                    <s-grid
                                                        gridTemplateColumns="auto minmax(0, 1fr) 88px 120px auto"
                                                        gap="base"
                                                        alignItems="center"
                                                    >
                                                        <s-grid-item>
                                                            <s-thumbnail
                                                                src={line.image_url || undefined}
                                                                alt={line.title || "Product"}
                                                                size="small"
                                                            />
                                                        </s-grid-item>

                                                        <s-grid-item>
                                                            <s-stack direction="block" gap="none">
                                                                <s-text type="strong">
                                                                    {line.title}
                                                                </s-text>
                                                                {line.variant_title && (
                                                                    <s-text tone="subdued">
                                                                        {line.variant_title}
                                                                    </s-text>
                                                                )}
                                                                {line.isNew && (
                                                                    <s-badge tone="info">New</s-badge>
                                                                )}
                                                            </s-stack>
                                                        </s-grid-item>

                                                        <s-grid-item>
                                                            <s-text-field
                                                                label="Qty"
                                                                type="number"
                                                                min="1"
                                                                value={line.quantity}
                                                                onInput={(event) =>
                                                                    updateLine(line.id, {
                                                                        quantity: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </s-grid-item>

                                                        <s-grid-item>
                                                            <s-text-field
                                                                label="Price"
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.current_price}
                                                                onInput={(event) =>
                                                                    updateLine(line.id, {
                                                                        current_price:
                                                                            event.target.value,
                                                                    })
                                                                }
                                                            />
                                                        </s-grid-item>

                                                        <s-grid-item>
                                                            <s-button
                                                                icon="delete"
                                                                variant="tertiary"
                                                                tone="critical"
                                                                accessibilityLabel={`Remove ${line.title}`}
                                                                onClick={() => removeLine(line.id)}
                                                            />
                                                        </s-grid-item>
                                                    </s-grid>
                                                </s-box>
                                            ))
                                        )}

                                        {fieldErrors.lines && (
                                            <s-banner tone="critical">{fieldErrors.lines}</s-banner>
                                        )}

                                        <s-stack direction="inline" gap="small-200">
                                            <s-button onClick={handleAddLineItem} icon="plus">
                                                Add line item
                                            </s-button>
                                        </s-stack>
                                    </s-stack>
                                </s-section>

                                <s-section heading="Delivery & Billing details">
                                    <s-stack direction="block" gap="base">
                                        <s-select
                                            label="Billing type"
                                            value={form.billingType}
                                            onChange={(event) =>
                                                updateForm({ billingType: event.target.value })
                                            }
                                        >
                                            <s-option value={BILLING_TYPES.PAY_AS_YOU_GO}>
                                                Pay as you go
                                            </s-option>
                                            <s-option value={BILLING_TYPES.PREPAID}>
                                                Pre-paid
                                            </s-option>
                                        </s-select>

                                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                                            <s-grid-item>
                                                <s-text-field
                                                    label="Delivery frequency"
                                                    type="number"
                                                    min="1"
                                                    value={form.deliveryFrequency}
                                                    error={fieldErrors.deliveryFrequency}
                                                    onInput={(event) =>
                                                        updateForm({
                                                            deliveryFrequency: event.target.value,
                                                        })
                                                    }
                                                />
                                            </s-grid-item>
                                            <s-grid-item>
                                                <s-select
                                                    label="Delivery interval"
                                                    value={form.deliveryInterval}
                                                    error={fieldErrors.deliveryInterval}
                                                    onChange={(event) =>
                                                        updateForm({
                                                            deliveryInterval: event.target.value,
                                                        })
                                                    }
                                                >
                                                    {DELIVERY_INTERVALS.map((interval) => (
                                                        <s-option key={interval} value={interval}>
                                                            {interval}
                                                        </s-option>
                                                    ))}
                                                </s-select>
                                            </s-grid-item>

                                            {form.billingType === BILLING_TYPES.PREPAID && (
                                                <>
                                                    <s-grid-item>
                                                        <s-select
                                                            label="Billing frequency"
                                                            value={form.billingFrequency}
                                                            error={fieldErrors.billingFrequency}
                                                            onChange={(event) =>
                                                                updateForm({
                                                                    billingFrequency:
                                                                        event.target.value,
                                                                })
                                                            }
                                                        >
                                                            {billingFrequencyOptions.map(
                                                                (option) => (
                                                                    <s-option
                                                                        key={option.value}
                                                                        value={option.value}
                                                                    >
                                                                        {option.label}
                                                                    </s-option>
                                                                )
                                                            )}
                                                        </s-select>
                                                    </s-grid-item>
                                                    <s-grid-item>
                                                        <s-select
                                                            label="Billing interval"
                                                            value={form.billingInterval}
                                                            disabled
                                                        >
                                                            <s-option value={form.billingInterval}>
                                                                {form.billingInterval}
                                                            </s-option>
                                                        </s-select>
                                                    </s-grid-item>
                                                </>
                                            )}
                                        </s-grid>

                                        <s-text-field
                                            label="Delivery price"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.deliveryPrice}
                                            error={fieldErrors.deliveryPrice}
                                            onInput={(event) =>
                                                updateForm({
                                                    deliveryPrice: event.target.value,
                                                })
                                            }
                                        />
                                    </s-stack>
                                </s-section>
                            </s-stack>
                        </s-grid-item>

                        <s-grid-item>
                            <s-section heading="Payment summary">
                                <s-stack direction="block" gap="base">
                                    <s-grid
                                        gridTemplateColumns="1fr auto"
                                        gap="small-200"
                                        alignItems="center"
                                    >
                                        <s-text tone="subdued">Subtotal</s-text>
                                        <s-text type="strong">
                                            {formatMoney(subtotal, currency)}
                                        </s-text>
                                    </s-grid>

                                    <s-grid
                                        gridTemplateColumns="1fr auto"
                                        gap="small-200"
                                        alignItems="center"
                                    >
                                        <s-text tone="subdued">{shippingTitle}</s-text>
                                        <s-text type="strong">
                                            {formatMoney(deliveryPrice, currency)}
                                        </s-text>
                                    </s-grid>

                                    <s-divider />

                                    <s-grid
                                        gridTemplateColumns="1fr auto"
                                        gap="small-200"
                                        alignItems="center"
                                    >
                                        <s-text type="strong">Total</s-text>
                                        <s-text type="strong">
                                            {formatMoney(total, currency)}
                                        </s-text>
                                    </s-grid>
                                </s-stack>
                            </s-section>
                        </s-grid-item>
                    </s-grid>
                </s-stack>
            </s-page>
        </div>
    );
}
