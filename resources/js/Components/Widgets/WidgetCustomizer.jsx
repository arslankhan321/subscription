import { FONT_FAMILY_OPTIONS } from "@/constants/widgetConstants";

function ColorField({ label, value, onChange }) {
    return (
        <s-text-field
            label={label}
            value={value}
            onInput={(e) => onChange(e.target.value)}
            placeholder="#000000"
        />
    );
}

export default function WidgetCustomizer({ settings, onChange }) {
    const updateSection = (section, key, value) => {
        onChange({
            ...settings,
            [section]: {
                ...settings[section],
                [key]: value,
            },
        });
    };

    const updateDisplay = (key, value) => {
        onChange({
            ...settings,
            display: {
                ...settings.display,
                [key]: value,
            },
        });
    };

    return (
        <s-stack direction="block" gap="base">
            <div className="widget-customizer-section">
                <s-text type="strong">Colors</s-text>
                <div className="widget-customizer-grid">
                    <ColorField
                        label="Primary"
                        value={settings.colors.primary}
                        onChange={(v) => updateSection("colors", "primary", v)}
                    />
                    <ColorField
                        label="Accent"
                        value={settings.colors.accent}
                        onChange={(v) => updateSection("colors", "accent", v)}
                    />
                    <ColorField
                        label="Text"
                        value={settings.colors.text}
                        onChange={(v) => updateSection("colors", "text", v)}
                    />
                    <ColorField
                        label="Background"
                        value={settings.colors.background}
                        onChange={(v) => updateSection("colors", "background", v)}
                    />
                    <ColorField
                        label="Border"
                        value={settings.colors.border}
                        onChange={(v) => updateSection("colors", "border", v)}
                    />
                    <ColorField
                        label="Pay as you go badge"
                        value={settings.colors.badgePayg}
                        onChange={(v) => updateSection("colors", "badgePayg", v)}
                    />
                    <ColorField
                        label="Prepaid badge"
                        value={settings.colors.badgePrepaid}
                        onChange={(v) => updateSection("colors", "badgePrepaid", v)}
                    />
                </div>
            </div>

            <div className="widget-customizer-section">
                <s-text type="strong">Typography & border</s-text>
                <div className="widget-customizer-grid">
                    <s-select
                        label="Font family"
                        value={settings.typography.fontFamily}
                        onChange={(e) => updateSection("typography", "fontFamily", e.target.value)}
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
                        onInput={(e) => updateSection("typography", "titleSize", e.target.value)}
                    />
                    <s-text-field
                        label="Body size (px)"
                        type="number"
                        value={settings.typography.bodySize}
                        onInput={(e) => updateSection("typography", "bodySize", e.target.value)}
                    />
                    <s-text-field
                        label="Font weight"
                        value={settings.typography.fontWeight}
                        onInput={(e) => updateSection("typography", "fontWeight", e.target.value)}
                    />
                    <s-text-field
                        label="Border width (px)"
                        type="number"
                        value={settings.border.width}
                        onInput={(e) => updateSection("border", "width", e.target.value)}
                    />
                    <s-text-field
                        label="Border radius (px)"
                        type="number"
                        value={settings.border.radius}
                        onInput={(e) => updateSection("border", "radius", e.target.value)}
                    />
                </div>
            </div>

            <div className="widget-customizer-section">
                <s-text type="strong">Labels</s-text>
                <div className="widget-customizer-grid">
                    {Object.entries(settings.labels).map(([key, labelValue]) => (
                        <s-text-field
                            key={key}
                            label={key.replace(/([A-Z])/g, " $1")}
                            value={labelValue}
                            onInput={(e) => updateSection("labels", key, e.target.value)}
                        />
                    ))}
                </div>
            </div>

            <div className="widget-customizer-section">
                <s-text type="strong">Display</s-text>
                <s-stack direction="block" gap="small-200">
                    <s-checkbox
                        label="Show discount badges"
                        checked={settings.display.showDiscount}
                        onChange={(e) => updateDisplay("showDiscount", e.target.checked)}
                    />
                    <s-checkbox
                        label="Show Pay as you go / Prepaid badges"
                        checked={settings.display.showBadges}
                        onChange={(e) => updateDisplay("showBadges", e.target.checked)}
                    />
                </s-stack>
            </div>
        </s-stack>
    );
}
