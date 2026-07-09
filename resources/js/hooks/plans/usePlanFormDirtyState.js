import { useCallback, useEffect, useMemo, useState } from "react";
import {
    buildAutoChargeSnapshot,
    buildRecurringInvoiceSnapshot,
    snapshotsEqual,
} from "@/utils/planFormSnapshots";

export function useAutoChargeDirtyState({
    isEdit,
    initialLoading,
    planName,
    products,
    deliveryOptions,
}) {
    const [baseline, setBaseline] = useState(null);

    const currentSnapshot = useMemo(
        () =>
            buildAutoChargeSnapshot({
                planName,
                products,
                deliveryOptions,
            }),
        [planName, products, deliveryOptions]
    );

    const isDirty = useMemo(() => {
        if (!baseline) return false;
        return !snapshotsEqual(baseline, currentSnapshot);
    }, [baseline, currentSnapshot]);

    const setBaselineFromCurrent = useCallback(() => {
        setBaseline(currentSnapshot);
    }, [currentSnapshot]);

    const setBaselineFromData = useCallback((data) => {
        setBaseline(
            buildAutoChargeSnapshot({
                planName: data.planName,
                products: data.products,
                deliveryOptions: data.deliveryOptions,
            })
        );
    }, []);

    useEffect(() => {
        if (!isEdit && !initialLoading && baseline === null) {
            setBaseline(currentSnapshot);
        }
    }, [isEdit, initialLoading, baseline, currentSnapshot]);

    return {
        isDirty,
        baseline,
        setBaselineFromCurrent,
        setBaselineFromData,
    };
}

export function useRecurringInvoiceDirtyState({
    isEdit,
    initialLoading,
    planName,
    products,
    intervalUnit,
    intervalOptions,
    subscriptionEmailHour,
    giveDiscount,
    discountAmount,
    discountDescription,
}) {
    const [baseline, setBaseline] = useState(null);

    const currentSnapshot = useMemo(
        () =>
            buildRecurringInvoiceSnapshot({
                planName,
                products,
                intervalUnit,
                intervalOptions,
                subscriptionEmailHour,
                giveDiscount,
                discountAmount,
                discountDescription,
            }),
        [
            planName,
            products,
            intervalUnit,
            intervalOptions,
            subscriptionEmailHour,
            giveDiscount,
            discountAmount,
            discountDescription,
        ]
    );

    const isDirty = useMemo(() => {
        if (!baseline) return false;
        return !snapshotsEqual(baseline, currentSnapshot);
    }, [baseline, currentSnapshot]);

    const setBaselineFromCurrent = useCallback(() => {
        setBaseline(currentSnapshot);
    }, [currentSnapshot]);

    const setBaselineFromData = useCallback((data) => {
        setBaseline(
            buildRecurringInvoiceSnapshot({
                planName: data.planName,
                products: data.products,
                intervalUnit: data.intervalUnit,
                intervalOptions: data.intervalOptions,
                subscriptionEmailHour: data.subscriptionEmailHour,
                giveDiscount: data.giveDiscount,
                discountAmount: data.discountAmount,
                discountDescription: data.discountDescription,
            })
        );
    }, []);

    useEffect(() => {
        if (!isEdit && !initialLoading && baseline === null) {
            setBaseline(currentSnapshot);
        }
    }, [isEdit, initialLoading, baseline, currentSnapshot]);

    return {
        isDirty,
        baseline,
        setBaselineFromCurrent,
        setBaselineFromData,
    };
}
