import { DEFAULT_WIDGET_SETTINGS, WIDGET_PRESETS } from "@/constants/widgetConstants";

const LEGACY_LABEL_KEYS = {
    title: "purchaseOptionsTitle",
    oneTime: "oneTimePurchase",
    subscribe: "subscribeAndSave",
    deliveryEvery: "deliverEvery",
};

function mergeSection(defaults, incoming = {}) {
    const merged = { ...defaults };

    for (const [key, value] of Object.entries(incoming)) {
        if (value != null && value !== "") {
            merged[key] = value;
        }
    }

    return merged;
}

function normalizeLabels(incoming = {}) {
    const normalized = { ...incoming };

    for (const [legacyKey, modernKey] of Object.entries(LEGACY_LABEL_KEYS)) {
        if (normalized[legacyKey] && !normalized[modernKey]) {
            normalized[modernKey] = normalized[legacyKey];
        }
    }

    return mergeSection(DEFAULT_WIDGET_SETTINGS.labels, normalized);
}

export function mergeWidgetSettings(settings = {}) {
    const incomingFeatures = settings.features ?? {};

    return {
        preset: settings.preset ?? DEFAULT_WIDGET_SETTINGS.preset,
        colors: mergeSection(DEFAULT_WIDGET_SETTINGS.colors, settings.colors),
        typography: mergeSection(DEFAULT_WIDGET_SETTINGS.typography, settings.typography),
        border: mergeSection(DEFAULT_WIDGET_SETTINGS.border, settings.border),
        labels: normalizeLabels(settings.labels),
        display: mergeSection(DEFAULT_WIDGET_SETTINGS.display, settings.display),
        features: {
            ...mergeSection(
                { ...DEFAULT_WIDGET_SETTINGS.features, benefits: undefined },
                { ...incomingFeatures, benefits: undefined }
            ),
            benefits:
                Array.isArray(incomingFeatures.benefits) && incomingFeatures.benefits.length > 0
                    ? incomingFeatures.benefits.filter(Boolean)
                    : DEFAULT_WIDGET_SETTINGS.features.benefits,
        },
    };
}

export function applyWidgetPreset(settings, presetId) {
    const preset = WIDGET_PRESETS.find((item) => item.id === presetId);
    if (!preset) return settings;

    const merged = mergeWidgetSettings(settings);

    return {
        ...merged,
        preset: presetId,
        colors: { ...merged.colors, ...preset.settings.colors },
        border: {
            ...merged.border,
            ...(preset.settings.border ?? {}),
        },
    };
}

export function buildWidgetCssVars(settings) {
    const merged = mergeWidgetSettings(settings);
    const { colors, typography, border } = merged;

    return {
        "--po-primary": colors.primary,
        "--po-secondary": colors.secondary,
        "--po-text": colors.text,
        "--po-border": colors.border,
        "--po-accent": colors.accent,
        "--po-highlight": colors.highlight,
        "--po-bg": colors.background,
        "--po-price": colors.price,
        "--po-font": typography.fontFamily,
        "--po-title-size": `${typography.titleSize}px`,
        "--po-body-size": `${typography.bodySize}px`,
        "--po-font-weight": typography.fontWeight,
        "--po-border-width": `${border.width}px`,
        "--po-border-radius": `${border.radius}px`,
    };
}

export function formatPrice(currency, amount) {
    const symbol = currency ?? "Rs.";
    const value = amount ?? "0.00";
    return `${symbol}${value}`;
}
