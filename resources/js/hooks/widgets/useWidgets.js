import { useCallback, useEffect, useState } from "react";
import { getWidgets, deleteWidget as deleteWidgetApi } from "@/Services/widgetService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useWidgets() {
    const [widgets, setWidgets] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWidgets = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getWidgets();
            setWidgets(response.data?.data ?? []);
        } catch (error) {
            console.error(error);
            showToast(getApiErrorMessage(error, "Unable to load widgets"), { isError: true });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWidgets();
    }, [fetchWidgets]);

    const removeWidget = useCallback(async (id) => {
        try {
            await deleteWidgetApi(id);
            setWidgets((prev) => prev.filter((widget) => widget.id !== id));
            showToast("Widget deleted");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to delete widget"), { isError: true });
            throw error;
        }
    }, []);

    return {
        widgets,
        loading,
        refetch: fetchWidgets,
        removeWidget,
    };
}
