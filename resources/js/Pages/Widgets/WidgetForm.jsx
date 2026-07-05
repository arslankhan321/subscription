import WidgetEditorTabs from "@/Components/Widgets/WidgetEditorTabs";
import WidgetLivePreview from "@/Components/Widgets/WidgetLivePreview";
import { getLayoutLabel } from "@/constants/widgetConstants";
import { useWidgetForm } from "@/hooks/widgets/useWidgetForm";
import "@/styles/widgets.css";

export default function WidgetForm({ widgetId = null, initialTemplate = null, onBack }) {
    const {
        isEdit,
        name,
        setName,
        template,
        settings,
        setSettings,
        loading,
        initialLoading,
        handlePublish,
    } = useWidgetForm({
        widgetId,
        initialTemplate,
        onSuccess: () => onBack?.(),
    });

    if (initialLoading) {
        return (
            <div className="widgets-page">
                <s-page heading="Loading widget...">
                    <s-text tone="subdued">Please wait...</s-text>
                </s-page>
            </div>
        );
    }

    const layoutLabel = getLayoutLabel(template);

    return (
        <div className="widgets-page widgets-page--editor">
            <s-page heading="Widget">
                <s-button slot="secondary-action" onClick={onBack}>
                    ← Back
                </s-button>
                <s-button
                    slot="primary-action"
                    variant="primary"
                    loading={loading}
                    onClick={handlePublish}
                >
                    Save & activate
                </s-button>

                <div className="widget-editor-header">
                    <div className="widget-editor-header__accent" />
                    <div className="widget-editor-header__body">
                        <div className="widget-editor-header__pill">
                            <span className="widget-editor-header__pill-dot" />
                            Storefront ready
                        </div>
                        <h2 className="widget-editor-header__title">{layoutLabel}</h2>
                        <p className="widget-editor-header__subtitle">
                            {name || "New widget"} · Customize labels, colors & features below
                        </p>
                    </div>
                </div>

                <div className="widget-editor-layout">
                    <div className="widget-editor-layout__sidebar">
                        <div className="widget-section-card">
                            <s-text-field
                                label="Widget name"
                                value={name}
                                required
                                onInput={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="widget-section-card widget-section-card--flush">
                            <WidgetEditorTabs settings={settings} onChange={setSettings} />
                        </div>
                    </div>

                    <div className="widget-editor-layout__preview">
                        <WidgetLivePreview
                            template={template}
                            settings={settings}
                            layoutName={layoutLabel}
                        />
                    </div>
                </div>
            </s-page>
        </div>
    );
}
