import { WIDGET_TEMPLATES } from "@/constants/widgetConstants";
import WidgetTemplateRenderer from "./WidgetTemplateRenderer";

export default function WidgetTemplatePicker({ value, onChange, settings, previewOptions }) {
    return (
        <div className="widget-template-picker">
            <s-text type="strong">Choose a design</s-text>
            <div className="widget-template-picker__grid">
                {WIDGET_TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        className={`widget-template-picker__item${value === template.id ? " widget-template-picker__item--active" : ""}`}
                        onClick={() => onChange(template.id)}
                    >
                        <div className="widget-template-picker__preview">
                            <WidgetTemplateRenderer
                                template={template.id}
                                settings={settings}
                                options={previewOptions}
                                selectedId="payg"
                                interactive={false}
                            />
                        </div>
                        <div className="widget-template-picker__meta">
                            <strong>{template.name}</strong>
                            <span>{template.description}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
