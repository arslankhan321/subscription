import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SHOP_SETTINGS, DEFAULT_TAG_SETTINGS } from "@/constants/settingsConstants";
import { getShopSettings, updateShopSettings } from "@/Services/settingsService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

export const SETTINGS_SAVE_BAR_ID = "shop-settings-save-bar";

const TAG_SETTING_KEYS = Object.keys(DEFAULT_TAG_SETTINGS);

function normalizeTagArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeSettings(data = {}) {
    const normalized = {
        ...DEFAULT_SHOP_SETTINGS,
        ...data,
        inventoryLocationIds: normalizeTagArray(data.inventoryLocationIds),
    };

    for (const key of TAG_SETTING_KEYS) {
        normalized[key] = normalizeTagArray(data[key]);
    }

    return normalized;
}

export function useShopSettings() {
    const [settings, setSettings] = useState(DEFAULT_SHOP_SETTINGS);
    const [savedSettings, setSavedSettings] = useState(DEFAULT_SHOP_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getShopSettings();
            const data = normalizeSettings(response.data?.data);

            setSettings(data);
            setSavedSettings(data);
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load settings"), { isError: true });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const isDirty = useMemo(
        () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
        [settings, savedSettings]
    );

    const save = useCallback(async () => {
        try {
            setSaving(true);
            const payload = {
                upcomingOrderNotificationDays: Number(settings.upcomingOrderNotificationDays),
                billingHour: Number(settings.billingHour),
                billingMinute: Number(settings.billingMinute),
                billingTimezone: settings.billingTimezone,
                paymentRetryAttempts: Number(settings.paymentRetryAttempts),
                paymentRetryDays: Number(settings.paymentRetryDays),
                paymentRetryFailedAction: settings.paymentRetryFailedAction,
                checkInventoryBeforeOrders: Boolean(settings.checkInventoryBeforeOrders),
                inventoryLocationIds: settings.inventoryLocationIds ?? [],
                inventoryPlacePartialOrders: Boolean(settings.inventoryPlacePartialOrders),
                inventoryCheckBuildABox: Boolean(settings.inventoryCheckBuildABox),
                inventoryRetryOutOfStock: Boolean(settings.inventoryRetryOutOfStock),
                firstOrderTags: settings.firstOrderTags ?? [],
                recurringOrderTags: settings.recurringOrderTags ?? [],
                customerActiveSubscriptionTags: settings.customerActiveSubscriptionTags ?? [],
                customerPausedSubscriptionTags: settings.customerPausedSubscriptionTags ?? [],
                customerCancelledSubscriptionTags: settings.customerCancelledSubscriptionTags ?? [],
                customerPaymentFailureTags: settings.customerPaymentFailureTags ?? [],
            };

            const response = await updateShopSettings(payload);

            const data = normalizeSettings(response.data?.data ?? settings);
            setSettings(data);
            setSavedSettings(data);
            showToast(response.data?.message || "Settings saved");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to save settings"), { isError: true });
        } finally {
            setSaving(false);
        }
    }, [settings]);

    const reset = useCallback(() => {
        setSettings(savedSettings);
    }, [savedSettings]);

    return {
        settings,
        setSettings,
        loading,
        saving,
        isDirty,
        saveBarId: SETTINGS_SAVE_BAR_ID,
        save,
        reset,
        handleSaveFromBar: save,
        handleDiscard: reset,
        refetch: fetchSettings,
    };
}
