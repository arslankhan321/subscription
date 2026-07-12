import { useEffect, useRef, useState } from "react";
import { syncSubscriptionCustomer } from "@/Services/subscriptionService";
import { formatCustomerName } from "@/utils/subscriptionHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";

function ExternalLinkIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
            <path d="M15.75 3a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-6.22 6.22a.75.75 0 1 1-1.06-1.06L13.94 4.5H10.5a.75.75 0 0 1 0-1.5h5.25Z" />
            <path d="M5.5 5.75A.75.75 0 0 1 6.25 5h3a.75.75 0 0 1 0 1.5h-2.5v8.5h8.5v-2.5a.75.75 0 0 1 1.5 0v3.25a.75.75 0 0 1-.75.75h-10a.75.75 0 0 1-.75-.75v-10Z" />
        </svg>
    );
}

function SyncIcon({ spinning = false }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            aria-hidden="true"
            fill="currentColor"
            className={spinning ? "customer-menu-icon--spin" : undefined}
        >
            <path d="M3.5 10a6.5 6.5 0 0 1 11.2-4.5l.55.55H13a.75.75 0 0 0 0 1.5h3.25a.75.75 0 0 0 .75-.75V3.55a.75.75 0 0 0-1.5 0v1.39l-.63-.63A8 8 0 1 0 18 10a.75.75 0 0 0-1.5 0A6.5 6.5 0 0 1 3.5 10Z" />
        </svg>
    );
}

export function CustomerCard({ customer, subscriptionId, onSynced }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);

        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [menuOpen]);

    const openExternal = (url) => {
        if (!url) {
            return;
        }

        window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleSync = async () => {
        if (!subscriptionId || syncing) {
            return;
        }

        setSyncing(true);

        try {
            const response = await syncSubscriptionCustomer(subscriptionId);
            onSynced?.(response.data?.data ?? null);
            showToast(response.data?.message || "Customer info synced");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to sync customer"), {
                isError: true,
            });
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div
            className={`subscription-card subscription-card--overflow-visible${
                menuOpen ? " subscription-card--menu-open" : ""
            }`}
        >
            <div className="subscription-card__header">
                <h3 className="subscription-card__title">Customer</h3>
                <div className="payment-method-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="payment-method-menu__trigger"
                        aria-label="Customer actions"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        ⋮
                    </button>
                    {menuOpen && (
                        <div className="payment-method-menu__dropdown">
                            <button
                                type="button"
                                className="payment-method-menu__item payment-method-menu__item--with-icon"
                                disabled={!customer?.admin_url}
                                onClick={() => {
                                    setMenuOpen(false);
                                    openExternal(customer?.admin_url);
                                }}
                            >
                                <span>Open customer in Shopify</span>
                                <ExternalLinkIcon />
                            </button>
                            <button
                                type="button"
                                className="payment-method-menu__item payment-method-menu__item--with-icon"
                                disabled={!customer?.orders_url}
                                onClick={() => {
                                    setMenuOpen(false);
                                    openExternal(customer?.orders_url);
                                }}
                            >
                                <span>View customer orders</span>
                                <ExternalLinkIcon />
                            </button>
                            <button
                                type="button"
                                className="payment-method-menu__item payment-method-menu__item--with-icon"
                                disabled={syncing || !customer?.shopify_customer_id}
                                onClick={() => {
                                    setMenuOpen(false);
                                    handleSync();
                                }}
                            >
                                <span>{syncing ? "Syncing..." : "Sync customer info"}</span>
                                <SyncIcon spinning={syncing} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="subscription-card__body">
                <p className="subscription-item-row__title">{formatCustomerName(customer)}</p>
                <p className="subscription-item-row__meta">{customer?.email || "No email"}</p>
                {customer?.phone && (
                    <p className="subscription-item-row__meta">{customer.phone}</p>
                )}
            </div>
        </div>
    );
}
