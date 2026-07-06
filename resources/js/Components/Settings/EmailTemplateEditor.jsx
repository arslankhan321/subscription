import EmailTemplatePreview from "@/Components/Settings/EmailTemplatePreview";

function ToggleSwitch({ checked, disabled = false, onChange, label }) {
    return (
        <label className={`email-toggle${disabled ? " email-toggle--disabled" : ""}`}>
            <input
                type="checkbox"
                className="email-toggle__input"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange?.(event.target.checked)}
            />
            <span className="email-toggle__track" aria-hidden="true" />
            {label && <span className="email-toggle__label">{label}</span>}
        </label>
    );
}

function SectionCard({ title, enabled, onToggle, children }) {
    return (
        <div className="email-editor-section">
            <div className="email-editor-section__header">
                <h4>{title}</h4>
                <ToggleSwitch checked={enabled} onChange={onToggle} />
            </div>
            {enabled && <div className="email-editor-section__body">{children}</div>}
        </div>
    );
}

export default function EmailTemplateEditor({
    template,
    onChange,
    onBack,
    onSave,
    onReset,
    onSendTest,
    onToggleEnabled,
    saving,
    resetting,
    sendingTest,
}) {
    if (!template) {
        return null;
    }

    const update = (patch) => onChange({ ...template, ...patch });

    const updateSettings = (key, value) => {
        onChange({
            ...template,
            settings: {
                ...template.settings,
                [key]: value,
            },
        });
    };

    const settings = template.settings ?? {};

    return (
        <div className="email-editor">
            <div className="email-editor__topbar">
                <button type="button" className="email-editor__back" onClick={onBack}>
                    ← Back to email templates
                </button>

                <div className="email-editor__title-row">
                    <div>
                        <h2 className="email-editor__title">&quot;{template.name}&quot; template</h2>
                        <span
                            className={`email-status-badge${
                                template.enabled ? " email-status-badge--enabled" : ""
                            }`}
                        >
                            {template.enabled ? "Enabled" : "Disabled"}
                        </span>
                    </div>

                    <div className="email-editor__actions">
                        <s-button
                            variant="secondary"
                            loading={sendingTest}
                            onClick={onSendTest}
                        >
                            Send test email
                        </s-button>
                        <s-button variant="secondary" loading={resetting} onClick={onReset}>
                            Reset to default
                        </s-button>
                        <s-button
                            variant={template.enabled ? "secondary" : "primary"}
                            onClick={() => onToggleEnabled?.(!template.enabled)}
                        >
                            {template.enabled ? "Disable" : "Enable"}
                        </s-button>
                        <s-button variant="primary" loading={saving} onClick={onSave}>
                            Save
                        </s-button>
                    </div>
                </div>
            </div>

            <div className="email-editor__layout">
                <div className="email-editor__form">
                    <div className="email-editor-block">
                        <s-text-field
                            label="Subject"
                            value={template.subject}
                            onInput={(event) => update({ subject: event.target.value })}
                        />
                    </div>

                    <div className="email-editor-block">
                        <label className="email-editor-block__label">Content (HTML)</label>
                        <textarea
                            className="email-editor-textarea"
                            rows={8}
                            value={template.bodyHtml}
                            onChange={(event) => update({ bodyHtml: event.target.value })}
                        />
                        <small className="email-editor-block__hint">
                            Use variables like {"{{ first_name }}"}, {"{{ order_date }}"},{" "}
                            {"{{ next_order_date }}"}
                        </small>
                    </div>

                    <SectionCard
                        title="Manage subscription button"
                        enabled={Boolean(settings.showBtn)}
                        onToggle={(value) => updateSettings("showBtn", value)}
                    >
                        <s-text-field
                            label="Button text"
                            value={settings.btnText ?? ""}
                            onInput={(event) => updateSettings("btnText", event.target.value)}
                        />
                        <label className="email-editor-inline-check">
                            <s-checkbox
                                checked={Boolean(settings.fullWidth)}
                                onChange={(event) =>
                                    updateSettings("fullWidth", event.target.checked)
                                }
                            />
                            <span>Full width</span>
                        </label>
                    </SectionCard>

                    <SectionCard
                        title="Line items"
                        enabled={Boolean(settings.showItems)}
                        onToggle={(value) => updateSettings("showItems", value)}
                    >
                        <s-text-field
                            label="Quantity title"
                            value={settings.qtyTitle ?? ""}
                            onInput={(event) => updateSettings("qtyTitle", event.target.value)}
                        />
                    </SectionCard>

                    <SectionCard
                        title="Shipping & billing addresses"
                        enabled={Boolean(settings.showAddresses)}
                        onToggle={(value) => updateSettings("showAddresses", value)}
                    >
                        <s-text-field
                            label="Shipping address title"
                            value={settings.shippingTitle ?? ""}
                            onInput={(event) => updateSettings("shippingTitle", event.target.value)}
                        />
                        <s-text-field
                            label="Billing address title"
                            value={settings.billingTitle ?? ""}
                            onInput={(event) => updateSettings("billingTitle", event.target.value)}
                        />
                        <label className="email-editor-block__label">Shipping address format</label>
                        <textarea
                            className="email-editor-textarea"
                            rows={4}
                            value={settings.shippingText ?? ""}
                            onChange={(event) => updateSettings("shippingText", event.target.value)}
                        />
                        <label className="email-editor-block__label">Billing address format</label>
                        <textarea
                            className="email-editor-textarea"
                            rows={4}
                            value={settings.billingText ?? ""}
                            onChange={(event) => updateSettings("billingText", event.target.value)}
                        />
                    </SectionCard>

                    <SectionCard
                        title="Next order date & payment method"
                        enabled={Boolean(settings.showOrderDate)}
                        onToggle={(value) => updateSettings("showOrderDate", value)}
                    >
                        <s-text-field
                            label="Next order date title"
                            value={settings.orderDateTitle ?? ""}
                            onInput={(event) => updateSettings("orderDateTitle", event.target.value)}
                        />
                        <s-text-field
                            label="Payment method title"
                            value={settings.paymentTitle ?? ""}
                            onInput={(event) => updateSettings("paymentTitle", event.target.value)}
                        />
                    </SectionCard>

                    <div className="email-editor-block">
                        <label className="email-editor-block__label">Footer text (HTML)</label>
                        <textarea
                            className="email-editor-textarea"
                            rows={4}
                            value={settings.footerText ?? ""}
                            onChange={(event) => updateSettings("footerText", event.target.value)}
                        />
                        <small className="email-editor-block__hint">
                            Use {"{{ merchant_support_email }}"} for your support address.
                        </small>
                    </div>
                </div>

                <aside className="email-editor__preview-pane">
                    <div className="email-editor__preview-header">
                        <h3>Preview</h3>
                        <s-text tone="subdued">Live sample data</s-text>
                    </div>
                    <EmailTemplatePreview template={template} />
                </aside>
            </div>
        </div>
    );
}
