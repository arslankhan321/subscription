import {
    BILLING_TIMEZONE_OPTIONS,
    formatBillingScheduleSummary,
    formatNotificationHelper,
} from "@/constants/settingsConstants";

function TimeStepper({ label, value, min, max, onChange }) {
    const numericValue = Number(value) || 0;
    const decrease = () => onChange(Math.max(min, numericValue - 1));
    const increase = () => onChange(Math.min(max, numericValue + 1));
    const display = label === "Minutes"
        ? `:${String(numericValue).padStart(2, "0")}`
        : String(numericValue).padStart(2, "0");

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
                <span className="settings-stepper__value">{display}</span>
                <s-button
                    icon="chevron-up"
                    variant="tertiary"
                    accessibilityLabel={`Increase ${label}`}
                    onClick={increase}
                />
            </div>
        </div>
    );
}

function SettingsRow({ title, description, children }) {
    return (
        <section className="settings-row">
            <div className="settings-row__aside">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
            <div className="settings-card">{children}</div>
        </section>
    );
}

export default function GeneralSettingsForm({ settings, onChange }) {
    const update = (key, value) => {
        onChange({ ...settings, [key]: value });
    };

    const billingSummary = formatBillingScheduleSummary(
        settings.billingHour,
        settings.billingMinute,
        settings.billingTimezone
    );

    return (
        <div className="settings-rows">
            <SettingsRow
                title="Notifications"
                description="Control when notifications are sent to the customer"
            >
                <h4 className="settings-card__title">Upcoming order notification</h4>

                <s-text-field
                    label="Days before renewal"
                    type="number"
                    value={String(settings.upcomingOrderNotificationDays)}
                    details={formatNotificationHelper(settings.upcomingOrderNotificationDays)}
                    onInput={(e) => update("upcomingOrderNotificationDays", e.target.value)}
                />
            </SettingsRow>

            <SettingsRow
                title="Billing schedule"
                description="The time of day when subscription billing is processed"
            >
                <h4 className="settings-card__title">Billing schedule hour and timezone</h4>

                <span className="settings-card__label">Processing time</span>
                <div className="settings-time-fields">
                    <TimeStepper
                        label="Hour"
                        value={settings.billingHour}
                        min={0}
                        max={23}
                        onChange={(value) => update("billingHour", value)}
                    />
                    <TimeStepper
                        label="Minutes"
                        value={settings.billingMinute}
                        min={0}
                        max={59}
                        onChange={(value) => update("billingMinute", value)}
                    />
                </div>

                <s-select
                    label="Timezone"
                    value={settings.billingTimezone}
                    onChange={(e) => update("billingTimezone", e.target.value)}
                >
                    {BILLING_TIMEZONE_OPTIONS.map((option) => (
                        <s-option key={option.value} value={option.value}>
                            {option.label}
                        </s-option>
                    ))}
                </s-select>

                <div className="settings-summary">{billingSummary}</div>
            </SettingsRow>
        </div>
    );
}
