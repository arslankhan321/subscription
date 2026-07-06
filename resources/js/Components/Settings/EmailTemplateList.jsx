function ToggleSwitch({ checked, disabled = false, onChange }) {
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
        </label>
    );
}

export default function EmailTemplateList({
    templates,
    loading,
    togglingKey,
    sendingTestKey,
    onView,
    onSendTest,
    onToggle,
}) {
    if (loading) {
        return <s-text tone="subdued">Loading email templates...</s-text>;
    }

    return (
        <div className="email-settings">
            <p className="email-settings__intro">
                Customize subscription notification emails sent to customers. Use View to edit
                content, Send test to preview in your inbox, and the toggle to enable or disable
                each notification.
            </p>

            <div className="email-template-list">
                <div className="email-template-list__head" aria-hidden="true">
                    <span>Template</span>
                    <span>Status</span>
                    <span>Preview</span>
                    <span>Test</span>
                    <span>Actions</span>
                </div>

                {templates.map((template) => (
                    <article key={template.key} className="email-template-card">
                        <div className="email-template-card__main">
                            <div className="email-template-card__icon-wrap">
                                <s-button
                                    icon={template.icon}
                                    variant="tertiary"
                                    accessibilityLabel={template.name}
                                />
                            </div>
                            <div className="email-template-card__copy">
                                <strong>{template.name}</strong>
                                <span className="email-template-card__type">{template.type}</span>
                            </div>
                        </div>

                        <div className="email-template-card__status">
                            <span
                                className={`email-status-badge${
                                    template.enabled ? " email-status-badge--enabled" : ""
                                }`}
                            >
                                {template.enabled ? "Enabled" : "Disabled"}
                            </span>
                        </div>

                        <div className="email-template-card__preview">
                            <s-button
                                icon="view"
                                variant="secondary"
                                onClick={() => onView?.(template.key)}
                            >
                                View
                            </s-button>
                        </div>

                        <div className="email-template-card__test">
                            <s-button
                                icon="send"
                                variant="secondary"
                                loading={sendingTestKey === template.key}
                                onClick={() => onSendTest?.(template.key)}
                            >
                                Send test
                            </s-button>
                        </div>

                        <div className="email-template-card__actions">
                            <ToggleSwitch
                                checked={template.enabled}
                                disabled={togglingKey === template.key}
                                onChange={(enabled) => onToggle?.(template.key, enabled)}
                            />
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}
