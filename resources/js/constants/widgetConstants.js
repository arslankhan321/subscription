export const WIDGET_LAYOUTS = [
    {
        id: "purchase_classic",
        name: "Purchase options (Classic)",
        tag: "CLASSIC",
        description: "All plans shown upfront with clear pricing",
        spec: "12px radius · 10px spacing",
        accent: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        glow: "rgba(99, 102, 241, 0.18)",
    },
    {
        id: "two_cards_compact",
        name: "Two cards (Compact)",
        tag: "COMPACT",
        description: "Compact cards with benefits list",
        spec: "14px radius · 12px spacing",
        accent: "linear-gradient(135deg, #059669, #34d399)",
        glow: "rgba(5, 150, 105, 0.2)",
        recommended: true,
    },
    {
        id: "classic_dropdown",
        name: "Classic dropdown",
        tag: "DROPDOWN",
        description: "Clean subscription with frequency picker",
        spec: "12px radius · 8px spacing",
        accent: "linear-gradient(135deg, #0284c7, #38bdf8)",
        glow: "rgba(2, 132, 199, 0.18)",
    },
    {
        id: "split_benefits",
        name: "Split cards + benefits",
        tag: "SPLIT",
        description: "Side-by-side options with trust signals",
        spec: "16px radius · 16px spacing",
        accent: "linear-gradient(135deg, #ea580c, #fb923c)",
        glow: "rgba(234, 88, 12, 0.18)",
    },
];

export const WIDGET_PRESETS = [
    {
        id: "lavender_classic",
        name: "Lavender Classic",
        tag: "CLASSIC",
        description: "Soft purple accents with balanced card spacing",
        spec: "12px radius · 10px spacing",
        gradient: "linear-gradient(135deg, #8b5cf6, #c4b5fd)",
        swatches: ["#8b5cf6", "#f5f3ff", "#1f2937", "#ffffff"],
        settings: {
            colors: {
                primary: "#7c3aed",
                secondary: "#f5f3ff",
                text: "#1f2937",
                border: "#ddd6fe",
                accent: "#8b5cf6",
                highlight: "#1f2937",
                background: "#ffffff",
                price: "#111827",
            },
        },
    },
    {
        id: "ocean_breeze",
        name: "Ocean Breeze",
        tag: "FRESH",
        description: "Cool blue tones with airy card spacing",
        spec: "14px radius · 12px spacing",
        gradient: "linear-gradient(135deg, #0ea5e9, #67e8f9)",
        swatches: ["#0ea5e9", "#ecfeff", "#0f172a", "#ffffff"],
        settings: {
            colors: {
                primary: "#0284c7",
                secondary: "#ecfeff",
                text: "#0f172a",
                border: "#bae6fd",
                accent: "#0ea5e9",
                highlight: "#0f172a",
                background: "#ffffff",
                price: "#0f172a",
            },
        },
    },
    {
        id: "forest_fresh",
        name: "Forest Fresh",
        tag: "NATURAL",
        description: "Earthy greens with generous card spacing",
        spec: "16px radius · 16px spacing",
        gradient: "linear-gradient(135deg, #059669, #6ee7b7)",
        swatches: ["#059669", "#ecfdf5", "#14532d", "#ffffff"],
        settings: {
            colors: {
                primary: "#047857",
                secondary: "#ecfdf5",
                text: "#14532d",
                border: "#a7f3d0",
                accent: "#10b981",
                highlight: "#14532d",
                background: "#ffffff",
                price: "#14532d",
            },
        },
    },
    {
        id: "sunset_glow",
        name: "Sunset Glow",
        tag: "WARM",
        description: "Warm coral accents with bold highlights",
        spec: "12px radius · 10px spacing",
        gradient: "linear-gradient(135deg, #f97316, #fdba74)",
        swatches: ["#f97316", "#fff7ed", "#431407", "#ffffff"],
        settings: {
            colors: {
                primary: "#ea580c",
                secondary: "#fff7ed",
                text: "#431407",
                border: "#fed7aa",
                accent: "#f97316",
                highlight: "#431407",
                background: "#ffffff",
                price: "#431407",
            },
        },
    },
];

export const WIDGET_STATUS = {
    DRAFT: "draft",
    ACTIVE: "active",
};

export const FONT_FAMILY_OPTIONS = [
    { value: "inherit", label: "Theme default" },
    { value: "Inter, sans-serif", label: "Inter" },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "'Helvetica Neue', Arial, sans-serif", label: "Helvetica" },
];

export const PREVIEW_FREQUENCIES = [
    {
        id: "freq-1",
        label: "Deliver every month",
        sublabel: null,
        billingType: "Pay as you go",
        price: "85.00",
        compareAt: "100.00",
        savePercent: "15%",
    },
    {
        id: "freq-2",
        label: "Deliver every 2 months",
        sublabel: "Charged every 2 months",
        billingType: "Pay as you go",
        price: "90.00",
        compareAt: "100.00",
        savePercent: "10%",
    },
    {
        id: "freq-3",
        label: "Deliver every 3 months",
        sublabel: "Charged every 6 months",
        billingType: "Prepaid",
        price: "75.00",
        compareAt: "100.00",
        savePercent: "25%",
    },
];

export const DEFAULT_BENEFITS = [
    "Lowest price option",
    "Easily swap & skip deliveries",
    "Cancel quickly anytime",
];

export const DEFAULT_WIDGET_SETTINGS = {
    preset: "lavender_classic",
    colors: {
        primary: "#7c3aed",
        secondary: "#f5f3ff",
        text: "#1f2937",
        border: "#d1d5db",
        accent: "#8b5cf6",
        highlight: "#111827",
        background: "#ffffff",
        price: "#111827",
        badgePayg: "#4f6df5",
        badgePrepaid: "#e8a317",
    },
    typography: {
        fontFamily: "Inter, sans-serif",
        titleSize: "12",
        bodySize: "14",
        fontWeight: "600",
    },
    border: {
        width: "2",
        radius: "12",
        style: "solid",
    },
    labels: {
        purchaseOptionsTitle: "Purchase options",
        oneTimePurchase: "One time purchase",
        subscribeAndSave: "Subscribe and save",
        subscriptionDetails: "Subscription details",
        perMonth: "per month",
        deliverEvery: "Deliver every",
        selectFrequency: "Select delivery frequency",
        rewardsTitle: "Subscription rewards",
        saveBadge: "Save",
    },
    display: {
        showDiscount: true,
        showBadges: true,
        showPrices: true,
        currencySymbol: "Rs.",
    },
    features: {
        showBenefits: true,
        benefits: DEFAULT_BENEFITS,
        showCardBadge: true,
        cardBadgeText: "Most Popular",
        showRewardsBanner: false,
        rewardsBannerText: "Subscribe today and unlock exclusive member rewards on every order.",
        showSubscriptionDetails: true,
    },
};

export function getLayoutById(id) {
    return WIDGET_LAYOUTS.find((layout) => layout.id === id);
}

export function getLayoutLabel(id) {
    return getLayoutById(id)?.name ?? id;
}

/** @deprecated use WIDGET_LAYOUTS */
export const WIDGET_TEMPLATES = WIDGET_LAYOUTS;

export const PREVIEW_OPTIONS = PREVIEW_FREQUENCIES;
