import { useCallback, useEffect, useState } from "react";
import { getInventoryLocations } from "@/Services/settingsService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export function useInventoryLocations(enabled = true) {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getInventoryLocations();
            setLocations(response.data?.data ?? []);
            setLoaded(true);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load inventory locations"), {
                isError: true,
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled && !loaded) {
            fetchLocations();
        }
    }, [enabled, loaded, fetchLocations]);

    return { locations, loading, refetch: fetchLocations };
}
