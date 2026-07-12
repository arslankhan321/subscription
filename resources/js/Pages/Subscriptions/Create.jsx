import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
import { useSelectCustomerModal } from "@/Components/Subscriptions/SelectCustomerModal";
import { BILLING_TYPES, DELIVERY_INTERVALS } from "@/constants/planConstants";
import { useShopifySaveBar } from "@/hooks/useShopifySaveBar";
import {
    createSubscription,
    getCustomerAddressesForCreate,
    getCustomerPaymentMethodsForCreate,
    getSubscriptionCreateMeta,
} from "@/Services/subscriptionService";
import {
    buildCreateSubscriptionPayload,
    buildDefaultCreateForm,
    calculateCreateSubtotal,
    getPrepaidBillingFrequencyOptions,
    mapPickerProductsToCreateLines,
    validateCreateSubscriptionForm,
} from "@/utils/subscriptionCreateHelpers";
import {
    formatMoney,
    formatPaymentMethod,
    goToSubscriptionDetail,
    goToSubscriptionsList,
} from "@/utils/subscriptionHelpers";
import {
    getCountryByCode,
    getCountryOptions,
    getCountryProvinces,
} from "@/utils/shopifyCountries";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/subscriptions.css";

const SAVE_BAR_ID = "subscription-create-save-bar";

function cloneForm(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
}

export default function SubscriptionCreate() {
    const navigate = useNavigate();
    const [form, setForm] = useState(() => buildDefaultCreateForm());
    const [baseline] = useState(() => buildDefaultCreateForm());
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [loadingCustomerExtras, setLoadingCustomerExtras] = useState(false);
    const [currencies, setCurrencies] = useState([{ code: "USD", name: "United States Dollar" }]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await getSubscriptionCreateMeta();
                const meta = response.data?.data || {};
                const currency = meta.currency_code || "USD";
                const list = Array.isArray(meta.currencies) && meta.currencies.length > 0
                    ? meta.currencies
                    : [{ code: currency, name: currency }];

                if (!cancelled) {
                    setCurrencies(list);
                    setForm((prev) => ({ ...prev, currencyCode: currency }));
                }
            } catch (error) {
                if (!cancelled) {
                    showToast(getApiErrorMessage(error, "Unable to load shop currencies"), {
                        isError: true,
                    });
                }
            } finally {
                if (!cancelled) {
                    setLoadingMeta(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const isDirty = useMemo(
        () => JSON.stringify(form) !== JSON.stringify(baseline),
        [form, baseline]
    );

    const { confirmLeave, hide: hideSaveBar } = useShopifySaveBar({
        id: SAVE_BAR_ID,
        isDirty,
        enabled: !loadingMeta,
    });

    const updateForm = useCallback((patch) => {
        setForm((prev) => {
            const next = { ...prev, ...patch };

            if (patch.billingType === BILLING_TYPES.PREPAID) {
                next.billingFrequency = prev.deliveryFrequency;
                next.billingInterval = prev.deliveryInterval;
            }

            if (patch.digitalProduct === true) {
                next.deliveryPrice = "0";
            }

            if (
                prev.billingType === BILLING_TYPES.PREPAID ||
                next.billingType === BILLING_TYPES.PREPAID
            ) {
                if (patch.deliveryFrequency !== undefined) {
                    next.billingFrequency = patch.deliveryFrequency;
                }
                if (patch.deliveryInterval !== undefined) {
                    next.billingInterval = patch.deliveryInterval;
                }
            }

            return next;
        });
        setFieldErrors({});
    }, []);

    const updateShipping = useCallback((patch) => {
        setForm((prev) => ({
            ...prev,
            shipping: { ...prev.shipping, ...patch },
        }));
        setFieldErrors({});
    }, []);

    const applyCustomer = useCallback(async (customer) => {
        setLoadingCustomerExtras(true);

        try {
            const [methodsResponse, addressesResponse] = await Promise.all([
                getCustomerPaymentMethodsForCreate(customer.id),
                getCustomerAddressesForCreate(customer.id),
            ]);

            const methods = methodsResponse.data?.data || [];
            const addresses = addressesResponse.data?.data || [];
            const defaultAddress = customer.default_address || addresses[0] || null;

            setForm((prev) => ({
                ...prev,
                customer,
                paymentMethods: methods,
                paymentMethodId: methods[0]?.id || "",
                shipping: {
                    first_name: defaultAddress?.first_name || customer.first_name || "",
                    last_name: defaultAddress?.last_name || customer.last_name || "",
                    company: defaultAddress?.company || "",
                    address1: defaultAddress?.address1 || "",
                    address2: defaultAddress?.address2 || "",
                    city: defaultAddress?.city || "",
                    province: defaultAddress?.province || "",
                    province_code: defaultAddress?.province_code || "",
                    country: defaultAddress?.country || "",
                    country_code: defaultAddress?.country_code || "",
                    zip: defaultAddress?.zip || "",
                    phone: defaultAddress?.phone || customer.phone || "",
                },
            }));
            setFieldErrors({});
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load customer details"), {
                isError: true,
            });
            setForm((prev) => ({
                ...prev,
                customer,
                paymentMethods: [],
                paymentMethodId: "",
            }));
        } finally {
            setLoadingCustomerExtras(false);
        }
    }, []);

    const { open: openCustomerModal, modal: customerModal } = useSelectCustomerModal({
        onSelect: applyCustomer,
    });

    const handleAddProducts = useCallback(async () => {
        if (!window.shopify?.resourcePicker) {
            showToast("Product picker is unavailable in this context", { isError: true });
            return;
        }

        try {
            const selected = await window.shopify.resourcePicker({
                type: "product",
                multiple: true,
                filter: { variants: true },
            });

            if (!selected?.length) {
                return;
            }

            setForm((prev) => ({
                ...prev,
                lines: [...prev.lines, ...mapPickerProductsToCreateLines(selected, prev.lines)],
            }));
            setFieldErrors({});
        } catch (err) {
            if (err?.message !== "Error: The user cancelled the picker" && !err?.code) {
                showToast(getApiErrorMessage(err, "Unable to open product picker"), {
                    isError: true,
                });
            }
        }
    }, []);

    const updateLine = useCallback((lineId, patch) => {
        setForm((prev) => ({
            ...prev,
            lines: prev.lines.map((line) =>
                line.id === lineId ? { ...line, ...patch } : line
            ),
        }));
    }, []);

    const removeLine = useCallback((lineId) => {
        setForm((prev) => ({
            ...prev,
            lines: prev.lines.filter((line) => line.id !== lineId),
        }));
    }, []);

    const subtotal = useMemo(() => calculateCreateSubtotal(form), [form]);
    const deliveryPrice = form.digitalProduct ? 0 : Number(form.deliveryPrice || 0);
    const total = subtotal + deliveryPrice;

    const billingFrequencyOptions = useMemo(
        () => getPrepaidBillingFrequencyOptions(form.deliveryFrequency || 1),
        [form.deliveryFrequency]
    );

    const countryOptions = useMemo(() => getCountryOptions(), []);
    const provinces = useMemo(
        () => getCountryProvinces(form.shipping.country_code),
        [form.shipping.country_code]
    );
    const isPrepaid = form.billingType === BILLING_TYPES.PREPAID;

    const handleDiscard = useCallback(() => {
        setForm(cloneForm(baseline));
        setFieldErrors({});
    }, [baseline]);

    const handleLeave = useCallback(async () => {
        await confirmLeave();
        hideSaveBar();
        goToSubscriptionsList(navigate);
    }, [confirmLeave, hideSaveBar, navigate]);

    const handleSave = useCallback(async () => {
        if (saving) {
            return;
        }

        const { valid, errors } = validateCreateSubscriptionForm(form);

        if (!valid) {
            setFieldErrors(errors);
            showToast(Object.values(errors)[0] || "Please fix the form errors", {
                isError: true,
            });
            return;
        }

        setSaving(true);

        try {
            const response = await createSubscription(buildCreateSubscriptionPayload(form));
            const created = response.data?.data;
            hideSaveBar();
            showToast("Subscription created");

            if (created?.id) {
                goToSubscriptionDetail(navigate, created.id);
            } else {
                goToSubscriptionsList(navigate);
            }
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to create subscription"), {
                isError: true,
            });
        } finally {
            setSaving(false);
        }
    }, [form, saving, hideSaveBar, navigate]);

    return (
        <div className="subscriptions-page">
            <s-page heading="Create subscription">
                <s-button slot="secondary-action" onClick={handleLeave}>
                    ← Back
                </s-button>

                <PlanSaveBar
                    id={SAVE_BAR_ID}
                    onSave={handleSave}
                    onDiscard={handleDiscard}
                    saving={saving}
                    saveLabel="Save"
                />

                <div className="subscription-create-layout">
                    <s-stack direction="block" gap="base">
                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Contract details</h3>
                            </div>
                            <div className="subscription-card__body subscription-create-grid">
                                <s-text-field
                                    label="Status"
                                    value="PAUSED"
                                    readOnly
                                    details="You will be able to activate the contract after it is created."
                                />

                                <div className="subscription-create-row">
                                    <s-text-field
                                        label="Next order date"
                                        type="date"
                                        value={form.nextOrderDate}
                                        error={fieldErrors.nextOrderDate}
                                        onInput={(event) =>
                                            updateForm({ nextOrderDate: event.target.value })
                                        }
                                    />
                                    <s-text-field
                                        label="Time"
                                        type="time"
                                        value={form.nextOrderTime}
                                        error={fieldErrors.nextOrderTime}
                                        onInput={(event) =>
                                            updateForm({ nextOrderTime: event.target.value })
                                        }
                                    />
                                </div>

                                <s-select
                                    label="Currency"
                                    value={form.currencyCode}
                                    onChange={(event) =>
                                        updateForm({ currencyCode: event.target.value })
                                    }
                                >
                                    {currencies.map((currency) => (
                                        <s-option key={currency.code} value={currency.code}>
                                            {currency.name
                                                ? `${currency.name} (${currency.code})`
                                                : currency.code}
                                        </s-option>
                                    ))}
                                </s-select>

                                <s-select
                                    label="Selling plan type"
                                    value={form.billingType}
                                    onChange={(event) =>
                                        updateForm({ billingType: event.target.value })
                                    }
                                >
                                    <s-option value={BILLING_TYPES.PAY_AS_YOU_GO}>
                                        Pay as you go
                                    </s-option>
                                    <s-option value={BILLING_TYPES.PREPAID}>Pre-paid</s-option>
                                </s-select>

                                <div className="subscription-create-row">
                                    <s-text-field
                                        label="Delivery frequency"
                                        type="number"
                                        min="1"
                                        value={form.deliveryFrequency}
                                        error={fieldErrors.deliveryFrequency}
                                        onInput={(event) =>
                                            updateForm({
                                                deliveryFrequency: event.target.value,
                                            })
                                        }
                                    />
                                    <s-select
                                        label="Interval"
                                        value={form.deliveryInterval}
                                        onChange={(event) =>
                                            updateForm({
                                                deliveryInterval: event.target.value,
                                            })
                                        }
                                    >
                                        {DELIVERY_INTERVALS.map((interval) => (
                                            <s-option key={interval} value={interval}>
                                                {interval}
                                            </s-option>
                                        ))}
                                    </s-select>
                                </div>

                                {isPrepaid && (
                                    <div className="subscription-create-row">
                                        <s-select
                                            label="Billing frequency"
                                            value={form.billingFrequency}
                                            onChange={(event) =>
                                                updateForm({
                                                    billingFrequency: event.target.value,
                                                })
                                            }
                                            error={fieldErrors.billingFrequency}
                                        >
                                            {billingFrequencyOptions.map((option) => (
                                                <s-option
                                                    key={option.value}
                                                    value={String(option.value)}
                                                >
                                                    {option.label}
                                                </s-option>
                                            ))}
                                        </s-select>
                                        <s-select
                                            label="Billing interval"
                                            value={form.billingInterval}
                                            onChange={(event) =>
                                                updateForm({
                                                    billingInterval: event.target.value,
                                                })
                                            }
                                            error={fieldErrors.billingInterval}
                                        >
                                            {DELIVERY_INTERVALS.map((interval) => (
                                                <s-option key={interval} value={interval}>
                                                    {interval}
                                                </s-option>
                                            ))}
                                        </s-select>
                                    </div>
                                )}

                                <div className="subscription-create-row">
                                    <s-text-field
                                        label="Minimum number of orders"
                                        type="number"
                                        min="1"
                                        value={form.billingMinCycles}
                                        details="Leave empty to disable"
                                        onInput={(event) =>
                                            updateForm({
                                                billingMinCycles: event.target.value || "",
                                            })
                                        }
                                    />
                                    <s-text-field
                                        label="Maximum number of orders"
                                        type="number"
                                        min="1"
                                        value={form.billingMaxCycles}
                                        details="Leave empty for unlimited"
                                        onInput={(event) =>
                                            updateForm({
                                                billingMaxCycles: event.target.value || "",
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Products</h3>
                                <s-button variant="tertiary" onClick={handleAddProducts}>
                                    Select products
                                </s-button>
                            </div>
                            <div className="subscription-card__body">
                                {fieldErrors.lines && (
                                    <s-banner tone="critical">{fieldErrors.lines}</s-banner>
                                )}
                                {form.lines.length === 0 ? (
                                    <s-text tone="subdued">No products selected</s-text>
                                ) : (
                                    <s-stack direction="block" gap="base">
                                        {form.lines.map((line) => (
                                            <s-box
                                                key={line.id}
                                                padding="base"
                                                borderWidth="base"
                                                borderRadius="base"
                                            >
                                                <s-grid
                                                    gridTemplateColumns="48px minmax(0, 1fr) 90px 110px auto"
                                                    gap="base"
                                                    alignItems="center"
                                                >
                                                    <s-grid-item>
                                                        {line.image_url ? (
                                                            <img
                                                                src={line.image_url}
                                                                alt=""
                                                                width="48"
                                                                height="48"
                                                                style={{
                                                                    objectFit: "cover",
                                                                    borderRadius: 8,
                                                                }}
                                                            />
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    width: 48,
                                                                    height: 48,
                                                                    borderRadius: 8,
                                                                    background: "#f1f2f3",
                                                                }}
                                                            />
                                                        )}
                                                    </s-grid-item>
                                                    <s-grid-item>
                                                        <s-stack direction="block" gap="none">
                                                            <s-text type="strong">{line.title}</s-text>
                                                            {line.variant_title && (
                                                                <s-text tone="subdued">
                                                                    {line.variant_title}
                                                                </s-text>
                                                            )}
                                                        </s-stack>
                                                    </s-grid-item>
                                                    <s-grid-item>
                                                        <s-text-field
                                                            label="Qty"
                                                            labelAccessibilityVisibility="exclusive"
                                                            type="number"
                                                            min="1"
                                                            value={line.quantity}
                                                            onInput={(event) =>
                                                                updateLine(line.id, {
                                                                    quantity: event.target.value,
                                                                })
                                                            }
                                                        />
                                                    </s-grid-item>
                                                    <s-grid-item>
                                                        <s-text-field
                                                            label="Price"
                                                            labelAccessibilityVisibility="exclusive"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={line.current_price}
                                                            onInput={(event) =>
                                                                updateLine(line.id, {
                                                                    current_price:
                                                                        event.target.value,
                                                                })
                                                            }
                                                        />
                                                    </s-grid-item>
                                                    <s-grid-item>
                                                        <s-button
                                                            tone="critical"
                                                            icon="delete"
                                                            onClick={() => removeLine(line.id)}
                                                        />
                                                    </s-grid-item>
                                                </s-grid>
                                            </s-box>
                                        ))}
                                    </s-stack>
                                )}
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Customer</h3>
                                <s-button variant="tertiary" onClick={openCustomerModal}>
                                    Select customer
                                </s-button>
                            </div>
                            <div className="subscription-card__body subscription-create-grid">
                                {fieldErrors.customer && (
                                    <s-banner tone="critical">{fieldErrors.customer}</s-banner>
                                )}
                                <s-text-field
                                    label="Customer"
                                    value={
                                        form.customer
                                            ? form.customer.display_name ||
                                              `${form.customer.first_name || ""} ${form.customer.last_name || ""}`.trim()
                                            : ""
                                    }
                                    readOnly
                                    placeholder="No customer selected"
                                />
                                <s-text-field
                                    label="Customer email"
                                    value={form.customer?.email || ""}
                                    readOnly
                                />
                                {loadingCustomerExtras ? (
                                    <s-text tone="subdued">Loading payment methods...</s-text>
                                ) : (
                                    <s-select
                                        label="Payment method"
                                        value={form.paymentMethodId}
                                        onChange={(event) =>
                                            updateForm({ paymentMethodId: event.target.value })
                                        }
                                        error={fieldErrors.paymentMethodId}
                                    >
                                        <s-option value="">Select payment method</s-option>
                                        {form.paymentMethods.map((method) => (
                                            <s-option key={method.id} value={method.id}>
                                                {formatPaymentMethod(method)}
                                            </s-option>
                                        ))}
                                    </s-select>
                                )}
                                {!loadingCustomerExtras &&
                                    form.customer &&
                                    form.paymentMethods.length === 0 && (
                                        <s-banner tone="warning">
                                            This customer has no saved payment methods. Add one in
                                            Shopify Admin before creating the subscription.
                                        </s-banner>
                                    )}
                            </div>
                        </div>

                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Delivery</h3>
                            </div>
                            <div className="subscription-card__body subscription-create-grid">
                                <label className="subscription-create-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={form.digitalProduct}
                                        onChange={(event) =>
                                            updateForm({ digitalProduct: event.target.checked })
                                        }
                                    />
                                    <span>Digital product</span>
                                </label>

                                {!form.digitalProduct && (
                                    <>
                                        <div className="subscription-create-row">
                                            <s-text-field
                                                label="Address 1"
                                                value={form.shipping.address1}
                                                onChange={(event) =>
                                                    updateShipping({
                                                        address1: event.target.value,
                                                    })
                                                }
                                                error={fieldErrors["shipping.address1"]}
                                            />
                                            <s-text-field
                                                label="Address 2"
                                                value={form.shipping.address2}
                                                onChange={(event) =>
                                                    updateShipping({
                                                        address2: event.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="subscription-create-row">
                                            <s-select
                                                label="Country"
                                                value={form.shipping.country_code}
                                                onChange={(event) => {
                                                    const code = event.target.value;
                                                    const country = getCountryByCode(code);
                                                    updateShipping({
                                                        country_code: code,
                                                        country: country?.name || "",
                                                        province: "",
                                                        province_code: "",
                                                    });
                                                }}
                                                error={fieldErrors["shipping.country_code"]}
                                            >
                                                <s-option value="">Select country</s-option>
                                                {countryOptions.map((country) => (
                                                    <s-option
                                                        key={country.code}
                                                        value={country.code}
                                                    >
                                                        {country.label}
                                                    </s-option>
                                                ))}
                                            </s-select>
                                            {provinces.length > 0 ? (
                                                <s-select
                                                    label="Province"
                                                    value={form.shipping.province_code}
                                                    onChange={(event) => {
                                                        const code = event.target.value;
                                                        const province = provinces.find(
                                                            (item) => item.code === code
                                                        );
                                                        updateShipping({
                                                            province_code: code,
                                                            province: province?.name || "",
                                                        });
                                                    }}
                                                >
                                                    <s-option value="">Select province</s-option>
                                                    {provinces.map((province) => (
                                                        <s-option
                                                            key={province.code}
                                                            value={province.code}
                                                        >
                                                            {province.name}
                                                        </s-option>
                                                    ))}
                                                </s-select>
                                            ) : (
                                                <s-text-field
                                                    label="Province"
                                                    value={form.shipping.province}
                                                    onChange={(event) =>
                                                        updateShipping({
                                                            province: event.target.value,
                                                        })
                                                    }
                                                />
                                            )}
                                        </div>
                                        <div className="subscription-create-row">
                                            <s-text-field
                                                label="City"
                                                value={form.shipping.city}
                                                onChange={(event) =>
                                                    updateShipping({ city: event.target.value })
                                                }
                                                error={fieldErrors["shipping.city"]}
                                            />
                                            <s-text-field
                                                label="Zip"
                                                value={form.shipping.zip}
                                                onChange={(event) =>
                                                    updateShipping({ zip: event.target.value })
                                                }
                                                error={fieldErrors["shipping.zip"]}
                                            />
                                        </div>
                                        <div className="subscription-create-row">
                                            <s-text-field
                                                label="First name"
                                                value={form.shipping.first_name}
                                                onChange={(event) =>
                                                    updateShipping({
                                                        first_name: event.target.value,
                                                    })
                                                }
                                            />
                                            <s-text-field
                                                label="Last name"
                                                value={form.shipping.last_name}
                                                onChange={(event) =>
                                                    updateShipping({
                                                        last_name: event.target.value,
                                                    })
                                                }
                                                error={fieldErrors["shipping.last_name"]}
                                            />
                                        </div>
                                        <s-text-field
                                            label="Phone"
                                            value={form.shipping.phone}
                                            onChange={(event) =>
                                                updateShipping({ phone: event.target.value })
                                            }
                                        />
                                    </>
                                )}

                                {!form.digitalProduct && (
                                    <div className="subscription-create-row">
                                        <s-text-field
                                            label="Delivery price"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.deliveryPrice}
                                            error={fieldErrors.deliveryPrice}
                                            onInput={(event) =>
                                                updateForm({
                                                    deliveryPrice: event.target.value,
                                                })
                                            }
                                        />
                                        <s-text-field
                                            label="Delivery method title"
                                            value={form.deliveryMethodTitle}
                                            onInput={(event) =>
                                                updateForm({
                                                    deliveryMethodTitle: event.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </s-stack>

                    <aside className="subscription-create-summary">
                        <div className="subscription-card">
                            <div className="subscription-card__header">
                                <h3 className="subscription-card__title">Summary</h3>
                            </div>
                            <div className="subscription-card__body">
                                <div className="subscription-create-summary__row">
                                    <span>Status</span>
                                    <strong>Paused</strong>
                                </div>
                                <div className="subscription-create-summary__row">
                                    <span>Next order</span>
                                    <strong>
                                        {form.nextOrderDate} {form.nextOrderTime}
                                    </strong>
                                </div>
                                <div className="subscription-create-summary__row">
                                    <span>Type</span>
                                    <strong>{form.billingType}</strong>
                                </div>
                                <div className="subscription-create-summary__row">
                                    <span>Delivery</span>
                                    <strong>
                                        Every {form.deliveryFrequency} {form.deliveryInterval}
                                    </strong>
                                </div>
                                <div className="subscription-create-summary__row">
                                    <span>Billing</span>
                                    <strong>
                                        Every{" "}
                                        {isPrepaid
                                            ? form.billingFrequency
                                            : form.deliveryFrequency}{" "}
                                        {isPrepaid
                                            ? form.billingInterval
                                            : form.deliveryInterval}
                                    </strong>
                                </div>
                                <div className="subscription-create-summary__row">
                                    <span>Products ({form.lines.length})</span>
                                    <strong>
                                        {form.lines.length === 0
                                            ? "None"
                                            : formatMoney(subtotal, form.currencyCode)}
                                    </strong>
                                </div>
                                {!form.digitalProduct && (
                                    <div className="subscription-create-summary__row">
                                        <span>Delivery</span>
                                        <strong>
                                            {formatMoney(deliveryPrice, form.currencyCode)}
                                        </strong>
                                    </div>
                                )}
                                <div className="subscription-create-summary__total">
                                    <span>Total</span>
                                    <strong>{formatMoney(total, form.currencyCode)}</strong>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {customerModal}
            </s-page>
        </div>
    );
}
