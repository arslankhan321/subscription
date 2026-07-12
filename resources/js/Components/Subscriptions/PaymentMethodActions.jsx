import { useCallback, useEffect, useRef, useState } from "react";
import { ModalListSkeleton } from "@/Components/Skeletons";
import {
    getSubscriptionPaymentMethods,
    swapSubscriptionPaymentMethod,
} from "@/Services/subscriptionService";
import { formatPaymentMethod } from "@/utils/subscriptionHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/skeleton.css";

const MODAL_ID = "swap-payment-method-modal";

function paymentMethodLabel(method) {
    if (!method) {
        return "Payment method";
    }

    if (method.paypal_email) {
        return `PayPal (${method.paypal_email})`;
    }

    const name = method.name ? `${method.name} - ` : "";
    const brand = method.brand || "Card";
    const digits = method.last_digits || method.masked_number?.slice(-4) || "••••";

    return `${name}${brand} •••• ${digits}`;
}

export function useSwapPaymentMethodModal({ subscriptionId, onSwapped }) {
    const modalRef = useRef(null);
    const [methods, setMethods] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [currentId, setCurrentId] = useState("");
    const [loading, setLoading] = useState(false);
    const [swapping, setSwapping] = useState(false);

    const close = useCallback(() => {
        modalRef.current?.hideOverlay?.();
    }, []);

    const open = useCallback(async () => {
        if (!subscriptionId) {
            return;
        }

        setLoading(true);
        setMethods([]);
        setSelectedId("");
        modalRef.current?.showOverlay?.();

        try {
            const response = await getSubscriptionPaymentMethods(subscriptionId);
            const payload = response.data?.data ?? {};
            const list = payload.methods ?? [];
            const current = payload.current?.id ?? "";

            setMethods(list);
            setCurrentId(current);
            setSelectedId(current || list[0]?.id || "");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load payment methods"), {
                isError: true,
            });
            close();
        } finally {
            setLoading(false);
        }
    }, [subscriptionId, close]);

    const canSwap =
        Boolean(selectedId) && selectedId !== currentId && methods.length > 1 && !swapping;

    const confirmSwap = useCallback(async () => {
        if (!canSwap) {
            return;
        }

        setSwapping(true);

        try {
            const response = await swapSubscriptionPaymentMethod(subscriptionId, selectedId);
            showToast(response.data?.message || "Payment method updated");
            onSwapped?.(response.data?.data ?? null);
            close();
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to swap payment method"), {
                isError: true,
            });
        } finally {
            setSwapping(false);
        }
    }, [canSwap, subscriptionId, selectedId, onSwapped, close]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Swap payment method"
            accessibilityLabel="Swap payment method"
            size="large"
        >
            <s-stack direction="block" gap="base">
                <p className="subscription-address-line">
                    Select one of the customer&apos;s available payment methods:
                </p>

                {loading ? (
                    <ModalListSkeleton rows={3} />
                ) : methods.length === 0 ? (
                    <s-banner tone="warning">
                        No saved payment methods found for this customer.
                    </s-banner>
                ) : (
                    <div className="payment-method-options">
                        {methods.map((method) => {
                            const isSelected = selectedId === method.id;
                            const isCurrent = method.is_current || method.id === currentId;

                            return (
                                <label
                                    key={method.id}
                                    className={`payment-method-option${
                                        isSelected ? " payment-method-option--selected" : ""
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="swap-payment-method"
                                        checked={isSelected}
                                        onChange={() => setSelectedId(method.id)}
                                    />
                                    <div className="payment-method-option__icon">
                                        {(method.brand || "C").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="payment-method-option__body">
                                        <p className="payment-method-option__title">
                                            {paymentMethodLabel(method)}
                                        </p>
                                        {(method.expiry_month || method.expiry_year) && (
                                            <p className="payment-method-option__meta">
                                                Expires {method.expiry_month}/{method.expiry_year}
                                            </p>
                                        )}
                                    </div>
                                    {isCurrent && <s-badge>Current</s-badge>}
                                </label>
                            );
                        })}
                    </div>
                )}

                {!loading && methods.length === 1 && (
                    <s-banner tone="info">This customer has only one payment method.</s-banner>
                )}
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={MODAL_ID}
                command="--hide"
                disabled={swapping}
                onClick={close}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={swapping}
                disabled={!canSwap}
                onClick={confirmSwap}
            >
                Swap
            </s-button>
        </s-modal>
    );

    return { open, modal };
}

export function PaymentMethodCard({
    paymentMethod,
    onSendUpdateLink,
    onManageCustomer,
    onSwap,
    sendingUpdate,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
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

    return (
        <div
            className={`subscription-card subscription-card--overflow-visible${
                menuOpen ? " subscription-card--menu-open" : ""
            }`}
        >
            <div className="subscription-card__header">
                <h3 className="subscription-card__title">Payment method</h3>
                <div className="payment-method-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="payment-method-menu__trigger"
                        aria-label="Payment method actions"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        ⋮
                    </button>
                    {menuOpen && (
                        <div className="payment-method-menu__dropdown">
                            <button
                                type="button"
                                className="payment-method-menu__item"
                                disabled={sendingUpdate || !paymentMethod?.id}
                                onClick={() => {
                                    setMenuOpen(false);
                                    onSendUpdateLink?.();
                                }}
                            >
                                {sendingUpdate ? "Sending..." : "Send link to update card"}
                            </button>
                            <button
                                type="button"
                                className="payment-method-menu__item"
                                disabled={!paymentMethod?.customer_admin_url}
                                onClick={() => {
                                    setMenuOpen(false);
                                    onManageCustomer?.();
                                }}
                            >
                                Manage payment on customer page
                            </button>
                            <button
                                type="button"
                                className="payment-method-menu__item"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onSwap?.();
                                }}
                            >
                                Swap payment method
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="subscription-card__body">
                <div className="payment-method-summary">
                    <div className="payment-method-option__icon">
                        {(paymentMethod?.brand || "B").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="subscription-address-line">
                            {paymentMethod?.masked_number ||
                                (paymentMethod?.last_digits
                                    ? `•••• •••• •••• ${paymentMethod.last_digits}`
                                    : formatPaymentMethod(paymentMethod))}
                        </p>
                        {paymentMethod?.expiry_month && paymentMethod?.expiry_year && (
                            <p className="subscription-item-row__meta">
                                Expires {paymentMethod.expiry_month}/{paymentMethod.expiry_year}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
