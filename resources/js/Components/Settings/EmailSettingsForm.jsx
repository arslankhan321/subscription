import { useCallback, useState } from "react";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
import { SettingsSkeleton } from "@/Components/Skeletons";
import EmailTemplateEditor from "@/Components/Settings/EmailTemplateEditor";
import EmailTemplateList from "@/Components/Settings/EmailTemplateList";
import {
    useEmailTemplateEditor,
    useEmailTemplates,
} from "@/hooks/settings/useEmailTemplates";
import { useShopifySaveBar } from "@/hooks/useShopifySaveBar";
import { toggleEmailTemplate } from "@/Services/emailTemplateService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/email-settings.css";
import "@/styles/skeleton.css";

const EMAIL_TEMPLATE_SAVE_BAR_ID = "email-template-save-bar";

export default function EmailSettingsForm() {
    const [activeKey, setActiveKey] = useState(null);
    const {
        templates,
        loading,
        togglingKey,
        sendingTestKey,
        refetch,
        toggleTemplate,
        sendTest,
    } = useEmailTemplates();

    const {
        template,
        setTemplate,
        loading: editorLoading,
        saving,
        resetting,
        sendingTest,
        isDirty,
        save,
        reset,
        sendTest: sendEditorTest,
        discard,
    } = useEmailTemplateEditor(activeKey);

    useShopifySaveBar({
        id: EMAIL_TEMPLATE_SAVE_BAR_ID,
        isDirty: Boolean(activeKey && isDirty),
        enabled: Boolean(activeKey && !editorLoading),
    });

    const handleBack = useCallback(() => {
        if (isDirty) {
            const shouldLeave = window.confirm(
                "You have unsaved changes. Discard them and go back?"
            );

            if (!shouldLeave) {
                return;
            }
        }

        setActiveKey(null);
        refetch();
    }, [isDirty, refetch]);

    const handleToggleEnabled = useCallback(
        async (enabled) => {
            if (!template) {
                return;
            }

            try {
                const response = await toggleEmailTemplate(template.key, enabled);
                const updated = response.data?.data;
                if (updated) {
                    setTemplate(updated);
                }
                showToast(response.data?.message || "Email notification updated");
                refetch();
            } catch (error) {
                showToast(getApiErrorMessage(error, "Unable to update email notification"), {
                    isError: true,
                });
            }
        },
        [template, setTemplate, refetch]
    );

    if (activeKey) {
        if (editorLoading || !template) {
            return <SettingsSkeleton />;
        }

        return (
            <>
                <PlanSaveBar
                    id={EMAIL_TEMPLATE_SAVE_BAR_ID}
                    onSave={save}
                    onDiscard={discard}
                    saving={saving}
                    saveLabel="Save"
                />

                <EmailTemplateEditor
                    template={template}
                    onChange={setTemplate}
                    onBack={handleBack}
                    onSave={save}
                    onReset={reset}
                    onSendTest={sendEditorTest}
                    onToggleEnabled={handleToggleEnabled}
                    saving={saving}
                    resetting={resetting}
                    sendingTest={sendingTest}
                />
            </>
        );
    }

    return (
        <EmailTemplateList
            templates={templates}
            loading={loading}
            togglingKey={togglingKey}
            sendingTestKey={sendingTestKey}
            onView={setActiveKey}
            onSendTest={sendTest}
            onToggle={toggleTemplate}
        />
    );
}
