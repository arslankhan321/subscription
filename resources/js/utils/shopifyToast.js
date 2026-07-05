export function showToast(message, { isError = false } = {}) {
    if (typeof window.shopify?.toast?.show === "function") {
        window.shopify.toast.show(message, { isError });
        return;
    }

    if (isError) {
        console.error(message);
    } else {
        console.log(message);
    }
}

export function getApiErrorMessage(error, fallback = "Something went wrong") {
    const data = error?.response?.data;

    if (data?.message && data.message !== "1") {
        return data.message;
    }

    if (Array.isArray(data?.errors) && data.errors.length) {
        const formatted = data.errors
            .map((item) => {
                if (typeof item === "string") return item;
                if (item?.message) {
                    const field = Array.isArray(item.field) ? item.field.join(".") : item.field;
                    return field ? `${field}: ${item.message}` : item.message;
                }
                return null;
            })
            .filter(Boolean)
            .join(" | ");

        if (formatted) return formatted;
    }

    if (data?.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
        const firstField = Object.keys(data.errors)[0];
        if (firstField && data.errors[firstField]?.[0]) {
            return data.errors[firstField][0];
        }
    }

    if (data?.message === "1") {
        return "Shopify API request failed. Please refresh the app and try again.";
    }

    return fallback;
}
