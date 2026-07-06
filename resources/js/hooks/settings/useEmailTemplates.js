import { useCallback, useEffect, useState } from "react";
import {
    getEmailTemplate,
    getEmailTemplates,
    resetEmailTemplate,
    sendEmailTemplateTest,
    toggleEmailTemplate,
    updateEmailTemplate,
} from "@/Services/emailTemplateService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useEmailTemplates() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [togglingKey, setTogglingKey] = useState(null);
    const [sendingTestKey, setSendingTestKey] = useState(null);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getEmailTemplates();
            setTemplates(response.data?.data ?? []);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load email templates"), {
                isError: true,
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const toggleTemplate = useCallback(async (key, enabled) => {
        try {
            setTogglingKey(key);
            const response = await toggleEmailTemplate(key, enabled);
            const updated = response.data?.data;

            if (updated) {
                setTemplates((current) =>
                    current.map((template) => (template.key === key ? { ...template, ...updated } : template))
                );
            }

            showToast(response.data?.message || "Email notification updated");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to update email notification"), {
                isError: true,
            });
        } finally {
            setTogglingKey(null);
        }
    }, []);

    const sendTest = useCallback(async (key) => {
        try {
            setSendingTestKey(key);
            const response = await sendEmailTemplateTest(key);
            showToast(response.data?.message || "Test email sent");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to send test email"), { isError: true });
        } finally {
            setSendingTestKey(null);
        }
    }, []);

    return {
        templates,
        loading,
        togglingKey,
        sendingTestKey,
        refetch: fetchTemplates,
        toggleTemplate,
        sendTest,
    };
}

export function useEmailTemplateEditor(templateKey) {
    const [template, setTemplate] = useState(null);
    const [savedTemplate, setSavedTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);

    const fetchTemplate = useCallback(async () => {
        if (!templateKey) {
            return;
        }

        try {
            setLoading(true);
            const response = await getEmailTemplate(templateKey);
            const data = response.data?.data ?? null;
            setTemplate(data);
            setSavedTemplate(data);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load email template"), { isError: true });
        } finally {
            setLoading(false);
        }
    }, [templateKey]);

    useEffect(() => {
        fetchTemplate();
    }, [fetchTemplate]);

    const save = useCallback(async () => {
        if (!template) {
            return;
        }

        try {
            setSaving(true);
            const response = await updateEmailTemplate(template.key, {
                enabled: template.enabled,
                subject: template.subject,
                bodyHtml: template.bodyHtml,
                settings: template.settings,
            });
            const data = response.data?.data ?? template;
            setTemplate(data);
            setSavedTemplate(data);
            showToast(response.data?.message || "Email template saved");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to save email template"), { isError: true });
        } finally {
            setSaving(false);
        }
    }, [template]);

    const reset = useCallback(async () => {
        if (!templateKey) {
            return;
        }

        try {
            setResetting(true);
            const response = await resetEmailTemplate(templateKey);
            const data = response.data?.data ?? null;
            setTemplate(data);
            setSavedTemplate(data);
            showToast(response.data?.message || "Email template reset");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to reset email template"), { isError: true });
        } finally {
            setResetting(false);
        }
    }, [templateKey]);

    const sendTest = useCallback(async () => {
        if (!templateKey) {
            return;
        }

        try {
            setSendingTest(true);
            const response = await sendEmailTemplateTest(templateKey);
            showToast(response.data?.message || "Test email sent");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to send test email"), { isError: true });
        } finally {
            setSendingTest(false);
        }
    }, [templateKey]);

    const discard = useCallback(() => {
        setTemplate(savedTemplate);
    }, [savedTemplate]);

    const isDirty =
        template && savedTemplate
            ? JSON.stringify(template) !== JSON.stringify(savedTemplate)
            : false;

    return {
        template,
        setTemplate,
        loading,
        saving,
        resetting,
        sendingTest,
        isDirty,
        save,
        reset,
        sendTest,
        discard,
        refetch: fetchTemplate,
    };
}
