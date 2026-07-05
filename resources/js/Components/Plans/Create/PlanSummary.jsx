import { formatPlanStatus } from "@/utils/planHelpers";

export default function PlanSummary({
    summary,
    deliveryOptions,
    loading,
    isEdit = false,
    isLocalOnly = false,
    onBack,
    onSaveDraft,
    onPublish,
    onSaveChanges,
}) {
    return (
        <div className="plan-summary-card">
            <h3 className="plan-summary-card__title">Plan summary</h3>

            {isEdit && summary.status && (
                <span className="plan-summary-card__badge">
                    {formatPlanStatus(summary.status)}
                </span>
            )}

            {isLocalOnly && (
                <span className="plan-summary-card__badge plan-summary-card__badge--local">
                    Local only — not synced to Shopify
                </span>
            )}

            <div className="plan-summary-item">
                <s-text tone="subdued">Widget</s-text>
                <s-text type="strong">{summary.widget}</s-text>
            </div>

            <div className="plan-summary-item">
                <s-text tone="subdued">
                    {isLocalOnly ? "Interval options" : "Delivery options"}
                </s-text>
                <s-text type="strong">
                    {summary.optionCount} option{summary.optionCount === 1 ? "" : "s"}
                </s-text>
            </div>

            <div className="plan-summary-item">
                <s-text tone="subdued">Products</s-text>
                {summary.productNames.length === 0 ? (
                    <s-text tone="subdued">None selected</s-text>
                ) : (
                    <s-unordered-list>
                        {summary.productNames.map((name) => (
                            <s-list-item key={name}>{name}</s-list-item>
                        ))}
                    </s-unordered-list>
                )}
            </div>

            {deliveryOptions.map((option, index) => (
                <div className="plan-summary-item" key={option.id}>
                    <s-text type="strong">
                        {option.name?.trim() || `Option ${index + 1}`}
                    </s-text>
                    <s-unordered-list>
                        <s-list-item>
                            Every {option.deliveryFrequency} {option.deliveryInterval}
                        </s-list-item>
                        {option.giveDiscount && (
                            <s-list-item>
                                {option.discountAmount}
                                {option.discountType === "Percentage off" ? "%" : ""} discount
                            </s-list-item>
                        )}
                    </s-unordered-list>
                </div>
            ))}

            <s-divider />

            <s-stack direction="block" gap="small-200">
                <s-button onClick={onBack} fullWidth>
                    Back to Plans
                </s-button>

                {isEdit ? (
                    <>
                        <s-button
                            variant="primary"
                            loading={loading}
                            onClick={onSaveChanges}
                            fullWidth
                        >
                            Save changes
                        </s-button>
                        <s-button
                            onClick={onSaveDraft}
                            loading={loading}
                            fullWidth
                        >
                            Save as draft
                        </s-button>
                        <s-button
                            onClick={onPublish}
                            loading={loading}
                            fullWidth
                        >
                            Publish plan
                        </s-button>
                    </>
                ) : (
                    <>
                        <s-button
                            onClick={onSaveDraft}
                            loading={loading}
                            fullWidth
                        >
                            Save as draft
                        </s-button>
                        <s-button
                            variant="primary"
                            loading={loading}
                            onClick={onPublish}
                            fullWidth
                        >
                            Publish
                        </s-button>
                    </>
                )}
            </s-stack>
        </div>
    );
}
