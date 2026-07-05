import { useCallback, useEffect } from "react";

export function useShopifySaveBar({ id, isDirty, enabled = true }) {
    useEffect(() => {
        if (!enabled || !id || typeof window.shopify?.saveBar?.show !== "function") {
            return undefined;
        }

        if (isDirty) {
            window.shopify.saveBar.show(id);
        } else {
            window.shopify.saveBar.hide(id);
        }

        return () => {
            window.shopify.saveBar.hide(id);
        };
    }, [id, isDirty, enabled]);

    const hide = useCallback(() => {
        if (typeof window.shopify?.saveBar?.hide === "function") {
            window.shopify.saveBar.hide(id);
        }
    }, [id]);

    const confirmLeave = useCallback(async () => {
        if (!isDirty) return true;

        if (typeof window.shopify?.saveBar?.leaveConfirmation === "function") {
            await window.shopify.saveBar.leaveConfirmation();
        }

        return true;
    }, [isDirty]);

    return { hide, confirmLeave };
}
