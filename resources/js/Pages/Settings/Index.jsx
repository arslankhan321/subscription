import { useState } from "react";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
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

    useShopifySaveBar({
        id: saveBarId,
        isDirty,
        enabled: !loading,
    });

    const activeMeta = getSettingsSection(activeSection) ?? getSettingsSection("general");

    return (
        <s-page heading="Settings" inlineSize="large">
            <PlanSaveBar
                id={saveBarId}
                onSave={handleSaveFromBar}
                onDiscard={handleDiscard}
                saving={saving}
                saveLabel="Save"
            />

            <div className="settings-shell">
                <aside>
                    <SettingsNav activeSection={activeSection} onChange={setActiveSection} />
                </aside>

                <main className="settings-main">
                    {loading ? (
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
