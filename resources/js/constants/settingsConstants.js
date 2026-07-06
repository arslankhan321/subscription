import { TIMEZONE_OPTIONS } from "@/Components/Settings/Timezone";

export const SETTINGS_SECTIONS = [
    {
        id: "general",
        label: "General Settings",
        description: "Configure notifications and widget settings",
        icon: "settings",
        available: true,
    },
    {
        id: "payment-recovery",
        label: "Payment Recovery",
        description: "Configure retry attempts for failed payments",
        icon: "payment",
        available: true,
    },
    {
        id: "inventory",
        label: "Inventory Management",
        description: "Check stock before subscription orders are placed",
        icon: "inventory",
        available: true,
    },
    {
        id: "email",
        label: "Email settings",
        description: "Manage email templates",
        icon: "email",
        available: false,
    },
    {
        id: "tags",
        label: "Tag settings",
        description: "Manage subscription order and customer tags",
        icon: "hashtag",
        available: true,
    },
    {
        id: "shipping",
        label: "Shipping profiles",
        description: "Manage shipping profiles",
        icon: "delivery",
        available: true,
    },
];

export const PAYMENT_RETRY_FAILED_ACTIONS = [
    {
        value: "cancel_subscription_and_notify",
        label: "Cancel subscription and send notification",
    },
    {
        value: "pause_subscription_and_notify",
        label: "Pause subscription and send notification",
    },
    {
        value: "skip_billing_and_notify_only",
        label: "Skip billing attempt and send notification only",
    },
];

export const BILLING_TIMEZONE_OPTIONS = TIMEZONE_OPTIONS;

export const DEFAULT_TAG_SETTINGS = {
    firstOrderTags: ["Force Subscriptions First Order"],
    recurringOrderTags: ["Force Subscriptions Recurring Order"],
    customerActiveSubscriptionTags: ["force-has-active-subscription"],
    customerPausedSubscriptionTags: ["force-has-paused-subscription"],
    customerCancelledSubscriptionTags: ["force-has-cancelled-subscription"],
    customerPaymentFailureTags: ["force-has-payment-failure"],
};

export const DEFAULT_SHOP_SETTINGS = {
    upcomingOrderNotificationDays: 1,
    billingHour: 10,
    billingMinute: 0,
    billingTimezone: "America/New_York",
    paymentRetryAttempts: 3,
    paymentRetryDays: 7,
    paymentRetryFailedAction: "pause_subscription_and_notify",
    checkInventoryBeforeOrders: true,
    inventoryLocationIds: [],
    inventoryPlacePartialOrders: false,
    inventoryCheckBuildABox: false,
    inventoryRetryOutOfStock: false,
    ...DEFAULT_TAG_SETTINGS,
};

/** @deprecated use DEFAULT_SHOP_SETTINGS */
export const DEFAULT_GENERAL_SETTINGS = DEFAULT_SHOP_SETTINGS;

export function getSettingsSection(id) {
    return SETTINGS_SECTIONS.find((section) => section.id === id);
}

export function getTimezoneLabel(value) {
    return TIMEZONE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatBillingScheduleSummary(hour, minute, timezone) {
    const paddedHour = String(hour).padStart(2, "0");
    const paddedMinute = String(minute).padStart(2, "0");
    const timezoneLabel = getTimezoneLabel(timezone);

    return `${paddedHour}:${paddedMinute} ${timezoneLabel}`;
}

export function formatNotificationHelper(days) {
    const count = Number(days) || 0;

    if (count === 0) {
        return "Send notification on the day of the upcoming order";
    }

    if (count === 1) {
        return "Send notification 1 day before the upcoming order";
    }

    return `Send notification ${count} days before the upcoming order`;
}
