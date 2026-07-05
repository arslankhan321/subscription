import { useCallback, useEffect, useState } from "react";
import { DEFAULT_WIDGET_SETTINGS, WIDGET_STATUS } from "@/constants/widgetConstants";
import { getLayoutLabel } from "@/constants/widgetConstants";
import {
    createWidget as createWidgetApi,
    getWidget,
    getWidgetDefaults,
    updateWidget as updateWidgetApi,
} from "@/Services/widgetService";
import { mergeWidgetSettings } from "@/utils/widgetStyleHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useWidgetForm({ widgetId = null, initialTemplate = null, onSuccess }) {
    const isEdit = Boolean(widgetId);

    const [name, setName] = useState("");
    const [template, setTemplate] = useState(initialTemplate ?? "purchase_classic");
    const [status, setStatus] = useState(WIDGET_STATUS.DRAFT);
    const [settings, setSettings] = useState(DEFAULT_WIDGET_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEdit);

    useEffect(() => {
        if (initialTemplate && !isEdit) {
            setTemplate(initialTemplate);
        }
    }, [initialTemplate, isEdit]);

    useEffect(() => {
        if (!isEdit) {
            getWidgetDefaults()
                .then((response) => {
                    setSettings(mergeWidgetSettings(response.data?.data ?? {}));
                })
                .catch(() => {
                    setSettings(mergeWidgetSettings({}));
                });
            return;
        }

        let cancelled = false;

        async function loadWidget() {
            try {
                setInitialLoading(true);
                const response = await getWidget(widgetId);
                const widget = response.data?.data;

                if (cancelled || !widget) return;

                setName(widget.name ?? "");
                setTemplate(widget.template ?? initialTemplate ?? "purchase_classic");
                setStatus(widget.status ?? WIDGET_STATUS.DRAFT);
                setSettings(mergeWidgetSettings(widget.settings ?? {}));
            } catch (error) {
                showToast(getApiErrorMessage(error, "Unable to load widget"), { isError: true });
            } finally {
                if (!cancelled) setInitialLoading(false);
            }
        }

        loadWidget();

        return () => {
            cancelled = true;
        };
    }, [isEdit, widgetId]);

    const submit = useCallback(
        async (nextStatus = status) => {
            const finalName = name.trim() || getLayoutLabel(template);

            const payload = {
                name: finalName,
                template,
                status: nextStatus,
                settings,
            };

            try {
                setLoading(true);
                const response = isEdit
                    ? await updateWidgetApi(widgetId, payload)
                    : await createWidgetApi(payload);

                showToast(response.data.message || "Widget saved");
                onSuccess?.(response.data.data);
            } catch (error) {
                showToast(getApiErrorMessage(error, "Unable to save widget"), { isError: true });
            } finally {
                setLoading(false);
            }
        },
        [name, template, status, settings, isEdit, widgetId, onSuccess]
    );

    const handleSaveDraft = useCallback(
        () => submit(WIDGET_STATUS.DRAFT),
        [submit]
    );

    const handlePublish = useCallback(
        () => submit(WIDGET_STATUS.ACTIVE),
        [submit]
    );

    return {
        isEdit,
        name,
        setName,
        template,
        setTemplate,
        status,
        settings,
        setSettings,
        loading,
        initialLoading,
        handleSaveDraft,
        handlePublish,
    };
}
