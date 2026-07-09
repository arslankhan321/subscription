import { useCallback, useEffect, useState } from "react";
import { getActiveWidgets } from "@/Services/widgetService";

export function useActiveWidgets() {
    const [widgets, setWidgets] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWidgets = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getActiveWidgets();
            setWidgets(response.data?.data ?? []);
        } catch (error) {
            console.error(error);
            setWidgets([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWidgets();
    }, [fetchWidgets]);

    const widgetOptions = widgets.map((widget) => ({
        value: widget.name,
        label: widget.name,
    }));

    return {
        widgets,
        widgetOptions,
        loading,
        refetch: fetchWidgets,
    };
}
