import { useState } from "react";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
import EmailSettingsForm from "@/Components/Settings/EmailSettingsForm";
import GeneralSettingsForm from "@/Components/Settings/GeneralSettingsForm";
import InventoryManagementForm from "@/Components/Settings/InventoryManagementForm";
import PaymentRecoveryForm from "@/Components/Settings/PaymentRecoveryForm";
import ShippingProfilesForm from "@/Components/Settings/ShippingProfilesForm";
import TagSettingsForm from "@/Components/Settings/TagSettingsForm";
import SettingsNav from "@/Components/Settings/SettingsNav";
import { getSettingsSection } from "@/constants/settingsConstants";
import { useShopSettings } from "@/hooks/settings/useShopSettings";
import { useShopifySaveBar } from "@/hooks/useShopifySaveBar";
import "@/styles/settings.css";

export default function SettingsIndex() {
    const [activeSection, setActiveSection] = useState("general");
    const {
        settings,
        setSettings,
        loading,
        saving,
        isDirty,
        saveBarId,
        handleSaveFromBar,
        handleDiscard,
    } = useShopSettings();

    const activeMeta = getSettingsSection(activeSection) ?? getSettingsSection("general");
    const needsShopSettings = ["general", "payment-recovery", "inventory", "tags"].includes(
        activeSection
    );
    const showSettingsLoading = needsShopSettings && loading;

    useShopifySaveBar({
        id: saveBarId,
        isDirty: needsShopSettings && isDirty,
        enabled: needsShopSettings && !loading,
    });

    return (
        <s-page heading="Settings" inlineSize="large">
            {needsShopSettings && (
                <PlanSaveBar
                    id={saveBarId}
                    onSave={handleSaveFromBar}
                    onDiscard={handleDiscard}
                    saving={saving}
                    saveLabel="Save"
                />
            )}

            <div className="settings-shell">
                <aside>
                    <SettingsNav activeSection={activeSection} onChange={setActiveSection} />
                </aside>

                <main className="settings-main">
                    {showSettingsLoading ? (
                        <s-text tone="subdued">Loading settings...</s-text>
                    ) : (
                        <>
                            <div className="settings-main__header">
                                <s-button
                                    icon={activeMeta?.icon ?? "settings"}
                                    variant="tertiary"
                                    accessibilityLabel={activeMeta?.label}
                                />
                                <s-heading>{activeMeta?.label}</s-heading>
                            </div>

                            {activeSection === "email" && <EmailSettingsForm />}

                            {activeSection === "general" && (
                                <GeneralSettingsForm
                                    settings={settings}
                                    onChange={setSettings}
                                />
                            )}

                            {activeSection === "payment-recovery" && (
                                <PaymentRecoveryForm
                                    settings={settings}
                                    onChange={setSettings}
                                />
                            )}

                            {activeSection === "inventory" && (
                                <InventoryManagementForm
                                    settings={settings}
                                    onChange={setSettings}
                                />
                            )}

                            {activeSection === "tags" && (
                                <TagSettingsForm
                                    settings={settings}
                                    onChange={setSettings}
                                />
                            )}

                            {activeSection === "shipping" && <ShippingProfilesForm />}
                        </>
                    )}
                </main>
            </div>
        </s-page>
    );
}
