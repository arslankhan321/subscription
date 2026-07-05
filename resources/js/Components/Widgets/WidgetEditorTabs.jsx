import { useState } from "react";
import {
    DEFAULT_BENEFITS,
    FONT_FAMILY_OPTIONS,
    WIDGET_PRESETS,
} from "@/constants/widgetConstants";
import { applyWidgetPreset } from "@/utils/widgetStyleHelpers";

const TABS = [
    { id: "presets", label: "Presets" },
    { id: "content", label: "Content" },
    { id: "style", label: "Style" },
    { id: "features", label: "Features" },
];

export default function WidgetEditorTabs({ settings, onChange }) {
    const [activeTab, setActiveTab] = useState("presets");

    const updateLabels = (key, value) => {
        onChange({
            ...settings,
            labels: { ...settings.labels, [key]: value },
        });
    };

    const updateColors = (key, value) => {
        onChange({
            ...settings,
            colors: { ...settings.colors, [key]: value },
        });
    };

    const updateBorder = (key, value) => {
        onChange({
            ...settings,
            border: { ...settings.border, [key]: value },
        });
    };

    const updateTypography = (key, value) => {
        onChange({
            ...settings,
            typography: { ...settings.typography, [key]: value },
        });
    };

    const updateDisplay = (key, value) => {
        onChange({
            ...settings,
            display: { ...settings.display, [key]: value },
        });
    };

    const updateFeatures = (key, value) => {
        onChange({
            ...settings,
            features: { ...settings.features, [key]: value },
        });
    };

    const applyPreset = (presetId) => {
        onChange(applyWidgetPreset(settings, presetId));
    };

    return (
        <div className="widget-editor-panel">
            <div className="widget-editor-panel__tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`widget-editor-panel__tab${activeTab === tab.id ? " widget-editor-panel__tab--active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="widget-editor-panel__body">
                {activeTab === "presets" && (
                    <div className="widget-presets-list">
                        {WIDGET_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                className={`widget-preset-card${settings.preset === preset.id ? " widget-preset-card--active" : ""}`}
                                onClick={() => applyPreset(preset.id)}
                            >
                                <div
                                    className="widget-preset-card__gradient"
                                    style={{ background: preset.gradient }}
                                />
                                <div className="widget-preset-card__content">
                                    <div className="widget-preset-card__top">
                                        <strong>{preset.name}</strong>
                                        <span className="widget-preset-card__tag">{preset.tag}</span>
                                    </div>
                                    <p>{preset.description}</p>
                                    <div className="widget-preset-card__footer">
                                        <span>{preset.spec}</span>
                                        <div className="widget-preset-card__swatches">
                                            {preset.swatches.map((color) => (
                                                <span
                                                    key={color}
                                                    style={{ background: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === "content" && (
                    <div className="widget-editor-grid">
                        {Object.entries(settings.labels).map(([key, value]) => (
                            <s-text-field
                                key={key}
                                label={key.replace(/([A-Z])/g, " $1")}
                                value={value}
                                onInput={(e) => updateLabels(key, e.target.value)}
                            />
                        ))}
                        <s-text-field
                            label="Currency symbol"
                            value={settings.display.currencySymbol}
                            onInput={(e) => updateDisplay("currencySymbol", e.target.value)}
                        />
                    </div>
                )}

                {activeTab === "style" && (
                    <div className="widget-editor-grid">
                        <s-select
                            label="Font family"
                            value={settings.typography.fontFamily}
                            onChange={(e) => updateTypography("fontFamily", e.target.value)}
                        >
                            {FONT_FAMILY_OPTIONS.map((font) => (
                                <s-option key={font.value} value={font.value}>
                                    {font.label}
                                </s-option>
                            ))}
                        </s-select>
                        <s-text-field
                            label="Title size (px)"
                            type="number"
                            value={settings.typography.titleSize}
                            onInput={(e) => updateTypography("titleSize", e.target.value)}
                        />
                        <s-text-field
                            label="Body size (px)"
                            type="number"
                            value={settings.typography.bodySize}
                            onInput={(e) => updateTypography("bodySize", e.target.value)}
                        />
                        <s-text-field
                            label="Border width (px)"
                            type="number"
                            value={settings.border.width}
                            onInput={(e) => updateBorder("width", e.target.value)}
                        />
                        <s-text-field
                            label="Border radius (px)"
                            type="number"
                            value={settings.border.radius}
                            onInput={(e) => updateBorder("radius", e.target.value)}
                        />
                        {Object.entries(settings.colors)
                            .filter(([key]) => !key.includes("badge"))
                            .map(([key, value]) => (
                                <s-text-field
                                    key={key}
                                    label={key.replace(/([A-Z])/g, " $1")}
                                    value={value}
                                    onInput={(e) => updateColors(key, e.target.value)}
                                />
                            ))}
                    </div>
                )}

                {activeTab === "features" && (
                    <s-stack direction="block" gap="base">
                        <s-checkbox
                            label="Show benefits list"
                            checked={settings.features.showBenefits}
                            onChange={(e) => updateFeatures("showBenefits", e.target.checked)}
                        />
                        {settings.features.showBenefits &&
                            DEFAULT_BENEFITS.map((_, index) => (
                                <s-text-field
                                    key={index}
                                    label={`Benefit ${index + 1}`}
                                    value={settings.features.benefits[index] ?? ""}
                                    onInput={(e) => {
                                        const benefits = [...settings.features.benefits];
                                        benefits[index] = e.target.value;
                                        updateFeatures("benefits", benefits);
                                    }}
                                />
                            ))}

                        <s-divider />

                        <s-checkbox
                            label="Show card badge"
                            checked={settings.features.showCardBadge}
                            onChange={(e) => updateFeatures("showCardBadge", e.target.checked)}
                        />
                        {settings.features.showCardBadge && (
                            <s-text-field
                                label="Badge text"
                                value={settings.features.cardBadgeText}
                                details={`${settings.features.cardBadgeText.length}/50`}
                                onInput={(e) => updateFeatures("cardBadgeText", e.target.value)}
                            />
                        )}

                        <s-divider />

                        <s-checkbox
                            label="Show subscription rewards banner"
                            checked={settings.features.showRewardsBanner}
                            onChange={(e) => updateFeatures("showRewardsBanner", e.target.checked)}
                        />
                        {settings.features.showRewardsBanner && (
                            <s-text-field
                                label="Rewards banner text"
                                value={settings.features.rewardsBannerText}
                                onInput={(e) =>
                                    updateFeatures("rewardsBannerText", e.target.value)
                                }
                            />
                        )}

                        <s-checkbox
                            label="Show subscription details link"
                            checked={settings.features.showSubscriptionDetails}
                            onChange={(e) =>
                                updateFeatures("showSubscriptionDetails", e.target.checked)
                            }
                        />
                    </s-stack>
                )}
            </div>
        </div>
    );
}
