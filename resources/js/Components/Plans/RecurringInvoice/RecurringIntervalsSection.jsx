import { EMAIL_SEND_HOUR_OPTIONS } from "@/constants/planConstants";

export default function RecurringIntervalsSection({
    intervalUnit,
    intervalOptions,
    onIntervalUnitChange,
    onIntervalChange,
    onAddInterval,
    onRemoveInterval,
}) {
    const unitLabel = intervalUnit === "days" ? "day(s)" : intervalUnit;

    return (
        <s-stack direction="block" gap="base">
            <s-select
                label="Interval unit"
                value={intervalUnit}
                onChange={(e) => onIntervalUnitChange(e.target.value)}
            >
                <s-option value="days">day(s)</s-option>
                <s-option value="weeks">week(s)</s-option>
                <s-option value="months">month(s)</s-option>
                <s-option value="years">year(s)</s-option>
            </s-select>

            <s-text type="strong">Interval options</s-text>
            <s-text tone="subdued">
                Your customer will be able to select one of these intervals.
            </s-text>

            {intervalOptions.map((option, index) => (
                <s-stack key={option.id} direction="inline" gap="base" alignItems="end">
                    <s-text-field
                        label={`Interval option #${index + 1}`}
                        type="number"
                        min="1"
                        value={option.frequency}
                        suffix={unitLabel}
                        onInput={(e) => onIntervalChange(option.id, e.target.value)}
                    />
                    {intervalOptions.length > 1 && (
                        <s-button
                            icon="delete"
                            tone="critical"
                            variant="tertiary"
                            accessibilityLabel="Remove interval"
                            onClick={() => onRemoveInterval(option.id)}
                        />
                    )}
                </s-stack>
            ))}

            <s-button icon="plus" onClick={onAddInterval}>
                Add interval option
            </s-button>

            <s-divider />

            <s-text type="strong">When should we send out subscription emails?</s-text>
        </s-stack>
    );
}

export function RecurringEmailSection({ subscriptionEmailHour, onChange }) {
    return (
        <s-select
            label="Email send time"
            value={subscriptionEmailHour}
            onChange={(e) => onChange(e.target.value)}
        >
            {EMAIL_SEND_HOUR_OPTIONS.map((option) => (
                <s-option key={option.value} value={option.value}>
                    {option.label}
                </s-option>
            ))}
        </s-select>
    );
}

export function RecurringDiscountSection({
    giveDiscount,
    discountAmount,
    discountDescription,
    onGiveDiscountChange,
    onDiscountAmountChange,
    onDiscountDescriptionChange,
}) {
    return (
        <s-stack direction="block" gap="base">
            <s-text type="strong">Subscription discount</s-text>

            <s-checkbox
                label="Offer discount on recurring orders"
                checked={giveDiscount}
                onChange={(e) => onGiveDiscountChange(e.target.checked)}
            />

            {giveDiscount && (
                <s-stack direction="block" gap="base">
                    <s-text-field
                        label="Discount percent"
                        type="number"
                        min="0"
                        max="100"
                        value={discountAmount}
                        suffix="%"
                        onInput={(e) => onDiscountAmountChange(e.target.value)}
                    />

                    <s-text-field
                        label="Discount description"
                        value={discountDescription}
                        details="Displayed below the subscription interval in the widget"
                        onInput={(e) => onDiscountDescriptionChange(e.target.value)}
                    />
                </s-stack>
            )}
        </s-stack>
    );
}
