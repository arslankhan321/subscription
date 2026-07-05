import { useMemo, useState } from "react";
import WidgetForm from "./WidgetForm";
import WidgetTemplateRenderer from "@/Components/Widgets/WidgetTemplateRenderer";
import { useWidgets } from "@/hooks/widgets/useWidgets";
import { getLayoutLabel, WIDGET_LAYOUTS, WIDGET_STATUS } from "@/constants/widgetConstants";
import { mergeWidgetSettings } from "@/utils/widgetStyleHelpers";
import "@/styles/widgets.css";

export default function WidgetsIndex() {
    const [view, setView] = useState({ mode: "listing", widgetId: null, template: null });
    const { widgets, loading, refetch } = useWidgets();

    const activeWidget = useMemo(
        () => widgets.find((widget) => widget.status === WIDGET_STATUS.ACTIVE) ?? widgets[0],
        [widgets]
    );

    if (view.mode === "form") {
        return (
            <WidgetForm
                widgetId={view.widgetId}
                initialTemplate={view.template}
                onBack={() => {
                    setView({ mode: "listing", widgetId: null, template: null });
                    refetch();
                }}
            />
        );
    }

    const openEditor = (widgetId = null, template = null) => {
        setView({ mode: "form", widgetId, template });
    };

    return (
        <div className="widgets-page">
            <s-page heading="Widget">
                {activeWidget && (
                    <s-button
                        slot="primary-action"
                        variant="primary"
                        onClick={() => openEditor(activeWidget.id)}
                    >
                        Edit template
                    </s-button>
                )}

                <div className="widget-hero">
                    <div className="widget-hero__blobs" aria-hidden="true">
                        <span className="widget-hero__blob widget-hero__blob--1" />
                        <span className="widget-hero__blob widget-hero__blob--2" />
                        <span className="widget-hero__blob widget-hero__blob--3" />
                    </div>

                    <div className="widget-hero__content">
                        <span className="widget-hero__eyebrow">
                            <span className="widget-hero__eyebrow-dot" />
                            Subscription Widget Studio
                        </span>
                        <h2 className="widget-hero__title">
                            Design purchase options that{" "}
                            <span className="widget-hero__title-accent">convert</span>
                        </h2>
                        <p className="widget-hero__text">
                            Pick a stunning layout for your product page — then fine-tune colors,
                            copy, and trust badges until it feels unmistakably yours.
                        </p>

                        <div className="widget-hero__stats">
                            <div className="widget-hero__stat">
                                <strong>{WIDGET_LAYOUTS.length}</strong>
                                <span>Premium layouts</span>
                            </div>
                            <div className="widget-hero__stat-divider" />
                            <div className="widget-hero__stat">
                                <strong>4</strong>
                                <span>Color presets</span>
                            </div>
                            <div className="widget-hero__stat-divider" />
                            <div className="widget-hero__stat">
                                <strong>Live</strong>
                                <span>Storefront preview</span>
                            </div>
                        </div>

                        <div className="widget-hero__badges">
                            <span className="widget-hero__badge widget-hero__badge--pulse">
                                ✦ {WIDGET_LAYOUTS.length} templates ready
                            </span>
                            {activeWidget && (
                                <span className="widget-hero__badge widget-hero__badge--saved">
                                    <span className="widget-hero__saved-dot" />
                                    Active: {activeWidget.name}
                                    <em>({getLayoutLabel(activeWidget.template)})</em>
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="widget-layouts-section">
                    <div className="widget-layouts-section__head">
                        <div>
                            <h3 className="widget-layouts-section__title">Available layouts</h3>
                            <p className="widget-layouts-section__subtitle">
                                Hover to preview · Click to customize
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="widget-layouts-skeleton">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="widget-layout-card widget-layout-card--skeleton" />
                            ))}
                        </div>
                    ) : (
                        <div className="widget-layouts-grid">
                            {WIDGET_LAYOUTS.map((layout) => {
                                const isSelected = activeWidget?.template === layout.id;

                                return (
                                    <article
                                        key={layout.id}
                                        className={`widget-layout-card${isSelected ? " widget-layout-card--selected" : ""}`}
                                        style={{ "--layout-glow": layout.glow }}
                                    >
                                        <div
                                            className="widget-layout-card__accent"
                                            style={{ background: layout.accent }}
                                        />

                                        {layout.recommended && (
                                            <span className="widget-layout-card__ribbon">Recommended</span>
                                        )}

                                        {isSelected && (
                                            <span className="widget-layout-card__selected-badge">
                                                <span className="widget-layout-card__check">✓</span>
                                                Live on store
                                            </span>
                                        )}

                                        <div className="widget-layout-card__preview">
                                            <div className="widget-layout-card__preview-glow" />
                                            <WidgetTemplateRenderer
                                                template={layout.id}
                                                settings={mergeWidgetSettings(
                                                    activeWidget?.settings ?? {}
                                                )}
                                                interactive={false}
                                                compact
                                            />
                                        </div>

                                        <div className="widget-layout-card__meta">
                                            <div className="widget-layout-card__meta-top">
                                                <strong>{layout.name}</strong>
                                                <span className="widget-layout-card__tag">{layout.tag}</span>
                                            </div>
                                            <p>{layout.description}</p>
                                            <span className="widget-layout-card__spec">{layout.spec}</span>
                                        </div>

                                        {isSelected ? (
                                            <button
                                                type="button"
                                                className="widget-layout-card__cta widget-layout-card__cta--primary"
                                                onClick={() => openEditor(activeWidget.id)}
                                            >
                                                Edit template →
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="widget-layout-card__cta"
                                                onClick={() => openEditor(null, layout.id)}
                                            >
                                                Use this layout
                                            </button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </s-page>
        </div>
    );
}
