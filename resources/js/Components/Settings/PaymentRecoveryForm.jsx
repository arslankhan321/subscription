import { PAYMENT_RETRY_FAILED_ACTIONS } from "@/constants/settingsConstants";

function NumberStepper({ label, value, min, max, details, onChange }) {
    const numericValue = Number(value) || 0;
    const decrease = () => onChange(Math.max(min, numericValue - 1));
    const increase = () => onChange(Math.min(max, numericValue + 1));

    return (
        <div className="settings-stepper">
            <span className="settings-stepper__label">{label}</span>
            <div className="settings-stepper__control">
                <s-button
                    icon="chevron-down"
                    variant="tertiary"
                    accessibilityLabel={`Decrease ${label}`}
                    onClick={decrease}
                />
                <span className="settings-stepper__value">{numericValue}</span>
                <s-button
                    icon="chevron-up"
                    variant="tertiary"
                    accessibilityLabel={`Increase ${label}`}
                    onClick={increase}
                />
            </div>
            {details && <small className="settings-stepper__details">{details}</small>}
        </div>
    );
}

export default function PaymentRecoveryForm({ settings, onChange }) {
    const update = (key, value) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <div className="settings-rows">
            <div className="settings-card settings-card--wide">
                <h4 className="settings-card__title">Payment method failure</h4>
                <p className="settings-card__description">
                    Control when billing attempts are made again after a failed attempt
                </p>

                <div className="settings-card__row-two">
                    <NumberStepper
                        label="Number of retry attempts"
                        value={settings.paymentRetryAttempts}
                        min={0}
                        max={10}
                        details="Min 0, max 10 retries"
                        onChange={(value) => update("paymentRetryAttempts", value)}
                    />
                    <NumberStepper
                        label="Days between payment retry attempts"
                        value={settings.paymentRetryDays}
                        min={1}
                        max={14}
                        details="Min 1, max 14 days"
                        onChange={(value) => update("paymentRetryDays", value)}
                    />
                </div>

                <s-select
                    label="Action when all retry attempts have failed"
                    value={settings.paymentRetryFailedAction}
                    onChange={(e) => update("paymentRetryFailedAction", e.target.value)}
                >
                    {PAYMENT_RETRY_FAILED_ACTIONS.map((option) => (
                        <s-option key={option.value} value={option.value}>
                            {option.label}
                        </s-option>
                    ))}
                </s-select>
            </div>
        </div>
    );
}
