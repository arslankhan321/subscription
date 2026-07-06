import { SETTINGS_SECTIONS } from "@/constants/settingsConstants";

export default function SettingsNav({ activeSection = "general", onChange }) {
    return (
        <nav className="settings-nav" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;

                return (
                    <button
                        key={section.id}
                        type="button"
                        className={`settings-nav__item${isActive ? " settings-nav__item--active" : ""}`}
                        onClick={() => section.available && onChange?.(section.id)}
                        disabled={!section.available}
                    >
                        <span className="settings-nav__icon" aria-hidden="true">
                            <s-button
                                icon={section.icon}
                                variant="tertiary"
                                accessibilityLabel={section.label}
                            />
                        </span>
                        <span className="settings-nav__copy">
                            <strong>{section.label}</strong>
                            <small>{section.description}</small>
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
