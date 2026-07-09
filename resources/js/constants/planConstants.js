export const DELIVERY_INTERVALS = ["days", "weeks", "months", "years"];

export const ORDER_LIMIT_OPTIONS = ["Disabled", "1", "2", "3", "4", "5", "6"];

export const MAX_ORDER_OPTIONS = ["Unlimited", "1", "2", "3", "4", "5", "6"];

export const DISCOUNT_TYPES = ["Percentage off", "Fixed price"];

export const BILLING_TYPES = {
    PAY_AS_YOU_GO: "Pay as you go",
    PREPAID: "Prepaid",
};

export const PLAN_STATUS = {
    DRAFT: "draft",
    ACTIVE: "active",
    ARCHIVED: "archived",
};

export const DEFAULT_PLAN_NAME = "Plan #1";

export const PLAN_TYPES = {
    AUTO_CHARGE: "auto_charge",
    RECURRING_INVOICE: "recurring_invoice",
};

export const BILLING_TYPE_RECURRING_INVOICE = "Recurring invoice";

export const EMAIL_SEND_HOUR_OPTIONS = [
    { value: "same_as_order", label: "The same hour as when initial order was made" },
    { value: "0", label: "12:00 AM" },
    { value: "6", label: "6:00 AM" },
    { value: "9", label: "9:00 AM" },
    { value: "12", label: "12:00 PM" },
    { value: "18", label: "6:00 PM" },
];

export const PLAN_TYPE_LABELS = {
    auto_charge: "Auto-charging subscription",
    recurring_invoice: "Recurring invoice",
};
