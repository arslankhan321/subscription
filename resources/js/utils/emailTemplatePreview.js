export const EMAIL_PREVIEW_SAMPLE = {
    first_name: "Jane",
    last_name: "Doe",
    order_date: "July 15, 2026",
    next_order_date: "August 15, 2026",
    merchant_support_email: "support@example.com",
    shipping_title: "Standard Shipping",
    payment_method: "Visa ending in 4242",
    manage_subscription_url: "#",
    delivery_address: {
        name: "Jane Doe",
        address1: "123 Main Street",
        address2: "Apt 4B",
    },
    billing_address: {
        name: "Jane Doe",
        address1: "123 Main Street",
        address2: "Apt 4B",
    },
    line_items: [
        { title: "Gray hat (example)", quantity: 1, price: "$25.00" },
        { title: "Black t-shirt (example)", quantity: 2, price: "$40.00" },
    ],
};

export function getNestedValue(data, path) {
    return path.split(".").reduce((value, key) => value?.[key], data);
}

export function renderEmailVariables(template = "", data = EMAIL_PREVIEW_SAMPLE) {
    return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
        const value = getNestedValue(data, key);
        return value == null ? "" : String(value);
    });
}
