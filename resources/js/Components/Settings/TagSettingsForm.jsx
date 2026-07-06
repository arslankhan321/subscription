import TagInputField from "@/Components/Settings/TagInputField";
import { DEFAULT_TAG_SETTINGS } from "@/constants/settingsConstants";

const ORDER_TAG_SECTIONS = [
    {
        key: "firstOrderTags",
        title: "First order tags (max 40 characters per tag)",
        helperText: "Applies to the first subscription order only. Press comma to add tags.",
    },
    {
        key: "recurringOrderTags",
        title: "Recurring order tags (max 40 characters per tag)",
        helperText: "Applies to all recurring subscription orders. Press comma to add tags.",
    },
];

const CUSTOMER_TAG_SECTIONS = [
    {
        key: "customerActiveSubscriptionTags",
        title: "Has active subscription",
        helperText: "Applies to customers with active subscriptions. Press comma to add tags.",
    },
    {
        key: "customerPausedSubscriptionTags",
        title: "Has paused subscription",
        helperText: "Applies to customers with paused subscriptions. Press comma to add tags.",
    },
    {
        key: "customerCancelledSubscriptionTags",
        title: "Has cancelled subscription",
        helperText: "Applies to customers with cancelled subscriptions. Press comma to add tags.",
    },
    {
        key: "customerPaymentFailureTags",
        title: "Has payment failure",
        helperText: "Applies to customers with failed payment attempts. Press comma to add tags.",
    },
];

export default function TagSettingsForm({ settings, onChange }) {
    const update = (key, value) => {
        onChange({ ...settings, [key]: value });
    };

    const resetField = (key) => {
        update(key, [...(DEFAULT_TAG_SETTINGS[key] ?? [])]);
    };

    return (
        <div className="settings-tag-sections">
            {ORDER_TAG_SECTIONS.map((section) => (
                <TagInputField
                    key={section.key}
                    title={section.title}
                    tags={settings[section.key] ?? []}
                    helperText={section.helperText}
                    onChange={(value) => update(section.key, value)}
                    onReset={() => resetField(section.key)}
                />
            ))}

            <div className="settings-tag-group">
                <h3 className="settings-tag-group__title">Customer tags</h3>

                {CUSTOMER_TAG_SECTIONS.map((section) => (
                    <TagInputField
                        key={section.key}
                        title={section.title}
                        tags={settings[section.key] ?? []}
                        helperText={section.helperText}
                        onChange={(value) => update(section.key, value)}
                        onReset={() => resetField(section.key)}
                    />
                ))}
            </div>
        </div>
    );
}
