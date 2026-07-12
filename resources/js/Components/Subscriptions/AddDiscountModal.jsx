import { useCallback, useMemo, useRef, useState } from "react";
import { addSubscriptionDiscount } from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

const MODAL_ID = "add-subscription-discount-modal";

const INITIAL_FORM = {
    title: "",
    type: "percentage",
    amount: "10",
    applies_to_all: false,
    line_id: "",
    limit_cycles: true,
    recurring_cycle_limit: "1",
};

export function useAddDiscountModal({ subscriptionId, products = [], onAdded }) {
    const modalRef = useRef(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);

    const open = useCallback(() => {
        setForm(INITIAL_FORM);
        modalRef.current?.showOverlay?.();
    }, []);

    const close = useCallback(() => {
        modalRef.current?.hideOverlay?.();
        setForm(INITIAL_FORM);
    }, []);

    const updateField = useCallback((key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const canSubmit = useMemo(() => {
        if (!form.title.trim() || !form.amount || Number(form.amount) < 0) {
            return false;
        }

        if (form.type === "percentage" && Number(form.amount) > 100) {
            return false;
        }

        if (!form.applies_to_all && !form.line_id) {
            return false;
        }

        if (form.limit_cycles && (!form.recurring_cycle_limit || Number(form.recurring_cycle_limit) < 1)) {
            return false;
        }

        return true;
    }, [form]);

    const submit = useCallback(async () => {
        if (!canSubmit || saving || !subscriptionId) {
            return;
        }

        setSaving(true);

        try {
            const response = await addSubscriptionDiscount(subscriptionId, {
                title: form.title.trim(),
                type: form.type,
                amount: Number(form.amount),
                applies_to_all: Boolean(form.applies_to_all),
                line_id: form.applies_to_all ? null : form.line_id,
                limit_cycles: Boolean(form.limit_cycles),
                recurring_cycle_limit: form.limit_cycles
                    ? Number(form.recurring_cycle_limit)
                    : null,
            });

            showToast(response.data?.message || "Discount applied");
            onAdded?.(response.data?.data ?? []);
            close();
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to apply discount"), { isError: true });
        } finally {
            setSaving(false);
        }
    }, [canSubmit, saving, subscriptionId, form, onAdded, close]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Add a discount"
            accessibilityLabel="Add a discount"
            size="large"
        >
            <s-stack direction="block" gap="base">
                <s-text-field
                    label="Discount name"
                    placeholder="Enter discount name"
                    value={form.title}
                    onInput={(event) => updateField("title", event.target.value)}
                />

                <s-select
                    label="Discount type"
                    value={form.type}
                    onChange={(event) => updateField("type", event.target.value)}
                >
                    <s-option value="percentage">Percentage</s-option>
                    <s-option value="fixed">Fixed amount</s-option>
                </s-select>

                {form.type === "percentage" ? (
                    <s-text-field
                        label="Percentage (%)"
                        type="number"
                        value={form.amount}
                        suffix="%"
                        onInput={(event) => updateField("amount", event.target.value)}
                    />
                ) : (
                    <s-text-field
                        label="Amount"
                        type="number"
                        value={form.amount}
                        onInput={(event) => updateField("amount", event.target.value)}
                    />
                )}

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                        type="checkbox"
                        checked={form.applies_to_all}
                        onChange={(event) => updateField("applies_to_all", event.target.checked)}
                    />
                    <span>Applies to all line items</span>
                </label>

                {!form.applies_to_all && (
                    <s-select
                        label="Target line item"
                        value={form.line_id}
                        onChange={(event) => updateField("line_id", event.target.value)}
                    >
                        <s-option value="">Select a line item</s-option>
                        {products.map((product) => (
                            <s-option
                                key={product.shopify_line_id || product.id}
                                value={product.shopify_line_id || ""}
                            >
                                {product.title}
                                {product.variant_title ? ` — ${product.variant_title}` : ""}
                            </s-option>
                        ))}
                    </s-select>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                        type="checkbox"
                        checked={form.limit_cycles}
                        onChange={(event) => updateField("limit_cycles", event.target.checked)}
                    />
                    <span>Limit the discount to a certain amount of cycles</span>
                </label>

                {form.limit_cycles && (
                    <s-text-field
                        label="Recurring cycle limit"
                        type="number"
                        value={form.recurring_cycle_limit}
                        details="Number of billing cycles this discount will apply to"
                        onInput={(event) =>
                            updateField("recurring_cycle_limit", event.target.value)
                        }
                    />
                )}
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                disabled={saving}
                onClick={close}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={saving}
                disabled={!canSubmit || saving}
                onClick={submit}
            >
                Apply discount
            </s-button>
        </s-modal>
    );

    return { open, close, modal };
}
