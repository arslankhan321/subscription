import { useCallback, useState } from "react";
import { BILLING_TYPES } from "@/constants/planConstants";
import { createDeliveryOption } from "@/utils/planHelpers";

export function useDeliveryOptions(initialOptions) {
    const [deliveryOptions, setDeliveryOptions] = useState(
        initialOptions ?? [createDeliveryOption()]
    );

    const updateOption = useCallback((id, patch) => {
        setDeliveryOptions((opts) =>
            opts.map((o) => {
                if (o.id !== id) return o;

                const updated = { ...o, ...patch };

                if (updated.billingType === BILLING_TYPES.PREPAID) {
                    if (patch.deliveryFrequency !== undefined) {
                        updated.billingFrequency = patch.deliveryFrequency;
                    }
                    if (patch.deliveryInterval !== undefined) {
                        updated.billingInterval = patch.deliveryInterval;
                    }
                }

                return updated;
            })
        );
    }, []);

    const toggleCollapsed = useCallback((id) => {
        setDeliveryOptions((opts) =>
            opts.map((o) => (o.id === id ? { ...o, collapsed: !o.collapsed } : o))
        );
    }, []);

    const addOption = useCallback(() => {
        setDeliveryOptions((opts) => [...opts, createDeliveryOption()]);
    }, []);

    const duplicateOption = useCallback((id) => {
        setDeliveryOptions((opts) => {
            const source = opts.find((o) => o.id === id);
            if (!source) return opts;

            const { id: _removed, ...rest } = source;
            const copy = createDeliveryOption({ ...rest, collapsed: source.collapsed });
            const index = opts.findIndex((o) => o.id === id);
            const next = [...opts];
            next.splice(index + 1, 0, copy);
            return next;
        });
    }, []);

    const removeOption = useCallback((id) => {
        setDeliveryOptions((opts) => opts.filter((o) => o.id !== id));
    }, []);

    const resetOptions = useCallback((options) => {
        setDeliveryOptions(options?.length ? options : [createDeliveryOption()]);
    }, []);

    return {
        deliveryOptions,
        setDeliveryOptions,
        updateOption,
        toggleCollapsed,
        addOption,
        duplicateOption,
        removeOption,
        resetOptions,
    };
}
