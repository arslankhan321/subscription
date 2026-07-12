import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModalListSkeleton } from "@/Components/Skeletons";
import {
    getSubscriptionAddresses,
    updateSubscriptionShippingAddress,
} from "@/Services/subscriptionService";
import {
    getCallingCodeLabel,
    toE164Phone,
    toNationalPhone,
} from "@/utils/phoneCodes";
import {
    getCountryByCode,
    getCountryByName,
    getCountryOptions,
    getCountryProvinces,
    getProvinceLabel,
    getZipLabel,
    resolveProvinceCode,
} from "@/utils/shopifyCountries";
import { formatShippingAddress } from "@/utils/subscriptionHelpers";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/skeleton.css";

const SELECT_MODAL_ID = "select-shipping-address-modal";
const EDIT_MODAL_ID = "edit-shipping-address-modal";

const EMPTY_FORM = {
    first_name: "",
    last_name: "",
    company: "",
    address1: "",
    address2: "",
    city: "",
    zip: "",
    country_code: "US",
    province_code: "",
    phone: "",
};

function addressToForm(shipping) {
    if (!shipping) {
        return { ...EMPTY_FORM };
    }

    const country =
        getCountryByCode(shipping.country_code) || getCountryByName(shipping.country);

    const countryCode = country?.code || shipping.country_code || "US";

    return {
        first_name: shipping.first_name || "",
        last_name: shipping.last_name || "",
        company: shipping.company || "",
        address1: shipping.address1 || "",
        address2: shipping.address2 || "",
        city: shipping.city || "",
        zip: shipping.zip || "",
        country_code: countryCode,
        province_code:
            resolveProvinceCode(
                countryCode,
                shipping.province_code || shipping.province
            ) || "",
        phone: toNationalPhone(shipping.phone, countryCode),
    };
}

function formatAddressBlock(address) {
    if (!address) {
        return [];
    }

    return formatShippingAddress(address) || [];
}

function addressFingerprint(address) {
    if (!address) {
        return "";
    }

    return [
        address.id,
        address.address1,
        address.address2,
        address.city,
        address.zip,
        address.country_code,
        address.province_code,
        address.first_name,
        address.last_name,
    ]
        .map((value) => String(value || "").trim().toLowerCase())
        .join("|");
}

export function useSelectShippingAddressModal({ subscriptionId, onUpdated }) {
    const modalRef = useRef(null);
    const [addresses, setAddresses] = useState([]);
    const [selectedId, setSelectedId] = useState("");
    const [currentId, setCurrentId] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const close = useCallback(() => {
        modalRef.current?.hideOverlay?.();
    }, []);

    const open = useCallback(async () => {
        if (!subscriptionId) {
            return;
        }

        setLoading(true);
        setAddresses([]);
        setSelectedId("");
        setCurrentId("");
        modalRef.current?.showOverlay?.();

        try {
            const response = await getSubscriptionAddresses(subscriptionId);
            const payload = response.data?.data ?? {};
            const list = payload.addresses ?? [];
            const current = list.find((item) => item.is_current) || payload.current;
            const currentKey = addressFingerprint(current);

            setAddresses(list);
            setCurrentId(current?.id || currentKey);
            setSelectedId(current?.id || currentKey || list[0]?.id || "");
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to load addresses"), {
                isError: true,
            });
            close();
        } finally {
            setLoading(false);
        }
    }, [subscriptionId, close]);

    const selectedAddress = useMemo(
        () =>
            addresses.find(
                (address) =>
                    address.id === selectedId ||
                    addressFingerprint(address) === selectedId
            ) || null,
        [addresses, selectedId]
    );

    const canUpdate = Boolean(
        selectedAddress &&
            !selectedAddress.is_current &&
            selectedId !== currentId &&
            !saving
    );

    const confirmUpdate = useCallback(async () => {
        if (!canUpdate || !selectedAddress) {
            return;
        }

        setSaving(true);

        try {
            const response = await updateSubscriptionShippingAddress(subscriptionId, {
                first_name: selectedAddress.first_name,
                last_name: selectedAddress.last_name,
                company: selectedAddress.company,
                address1: selectedAddress.address1,
                address2: selectedAddress.address2,
                city: selectedAddress.city,
                province: selectedAddress.province,
                province_code: selectedAddress.province_code,
                country: selectedAddress.country,
                country_code: selectedAddress.country_code,
                zip: selectedAddress.zip,
                phone: selectedAddress.phone,
            });

            showToast(response.data?.message || "Shipping address updated");
            onUpdated?.(response.data?.data ?? null);
            close();
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to update address"), {
                isError: true,
            });
        } finally {
            setSaving(false);
        }
    }, [canUpdate, selectedAddress, subscriptionId, onUpdated, close]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={SELECT_MODAL_ID}
            heading="Select a different address"
            accessibilityLabel="Select a different address"
            size="large"
        >
            <s-stack direction="block" gap="base">
                {loading ? (
                    <ModalListSkeleton rows={3} />
                ) : addresses.length === 0 ? (
                    <s-banner tone="warning">
                        No saved addresses found for this customer.
                    </s-banner>
                ) : (
                    <div className="shipping-address-options">
                        {addresses.map((address) => {
                            const optionId = address.id || addressFingerprint(address);
                            const isSelected = selectedId === optionId;

                            return (
                                <label
                                    key={optionId}
                                    className={`shipping-address-option${
                                        isSelected ? " shipping-address-option--selected" : ""
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="select-shipping-address"
                                        checked={isSelected}
                                        onChange={() => setSelectedId(optionId)}
                                    />
                                    <div className="shipping-address-option__body">
                                        {formatAddressBlock(address).map((line) => (
                                            <p key={line} className="subscription-address-line">
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                    {address.is_current && <s-badge>Current</s-badge>}
                                </label>
                            );
                        })}
                    </div>
                )}
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={SELECT_MODAL_ID}
                command="--hide"
                disabled={saving}
                onClick={close}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={saving}
                disabled={!canUpdate}
                onClick={confirmUpdate}
            >
                Update
            </s-button>
        </s-modal>
    );

    return { open, modal };
}

export function useEditShippingAddressModal({ subscriptionId, shipping, onUpdated }) {
    const modalRef = useRef(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const countryOptions = useMemo(() => getCountryOptions(), []);

    const provinces = useMemo(
        () => getCountryProvinces(form.country_code),
        [form.country_code]
    );
    const showProvince = provinces.length > 0;
    const provinceLabel = getProvinceLabel(form.country_code);
    const zipLabel = getZipLabel(form.country_code);

    const close = useCallback(() => {
        modalRef.current?.hideOverlay?.();
    }, []);

    const open = useCallback(() => {
        setForm(addressToForm(shipping));
        modalRef.current?.showOverlay?.();
    }, [shipping]);

    const updateField = useCallback((key, value) => {
        setForm((prev) => {
            if (key === "country_code") {
                const nextProvinces = getCountryProvinces(value);
                const keepProvince =
                    nextProvinces.some((item) => item.code === prev.province_code) &&
                    nextProvinces.length > 0;

                return {
                    ...prev,
                    country_code: value,
                    province_code: keepProvince ? prev.province_code : "",
                };
            }

            return { ...prev, [key]: value };
        });
    }, []);

    const canSave = useMemo(() => {
        if (
            !form.last_name.trim() ||
            !form.address1.trim() ||
            !form.city.trim() ||
            !form.zip.trim() ||
            !form.country_code
        ) {
            return false;
        }

        if (showProvince && !form.province_code) {
            return false;
        }

        if (form.phone.trim()) {
            const e164 = toE164Phone(form.phone, form.country_code);
            if (!e164) {
                return false;
            }
        }

        return true;
    }, [form, showProvince]);

    const submit = useCallback(async () => {
        if (!canSave || saving || !subscriptionId) {
            return;
        }

        setSaving(true);

        try {
            const country = getCountryByCode(form.country_code);
            const province = provinces.find((item) => item.code === form.province_code);
            const phone = toE164Phone(form.phone, form.country_code);

            if (form.phone.trim() && !phone) {
                showToast("Enter a valid phone number with country code", {
                    isError: true,
                });
                setSaving(false);
                return;
            }

            const response = await updateSubscriptionShippingAddress(subscriptionId, {
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                company: form.company.trim() || null,
                address1: form.address1.trim(),
                address2: form.address2.trim() || null,
                city: form.city.trim(),
                province: showProvince ? province?.name || null : null,
                province_code: showProvince ? form.province_code || null : null,
                country: country?.name || null,
                country_code: form.country_code,
                zip: form.zip.trim(),
                phone,
            });

            showToast(response.data?.message || "Shipping address updated");
            onUpdated?.(response.data?.data ?? null);
            close();
        } catch (error) {
            showToast(getApiErrorMessage(error, "Unable to save address"), {
                isError: true,
            });
        } finally {
            setSaving(false);
        }
    }, [
        canSave,
        saving,
        subscriptionId,
        form,
        provinces,
        showProvince,
        onUpdated,
        close,
    ]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={EDIT_MODAL_ID}
            heading="Edit shipping address"
            accessibilityLabel="Edit shipping address"
            size="large"
        >
            <s-stack direction="block" gap="base">
                <div className="shipping-address-form-row">
                    <s-text-field
                        label="First name"
                        value={form.first_name}
                        onInput={(event) => updateField("first_name", event.target.value)}
                    />
                    <s-text-field
                        label="Last name"
                        value={form.last_name}
                        required
                        onInput={(event) => updateField("last_name", event.target.value)}
                    />
                </div>

                <s-text-field
                    label="Company"
                    value={form.company}
                    onInput={(event) => updateField("company", event.target.value)}
                />

                <s-text-field
                    label="Address"
                    value={form.address1}
                    required
                    onInput={(event) => updateField("address1", event.target.value)}
                />

                <s-text-field
                    label="Apartment, suite, etc"
                    value={form.address2}
                    onInput={(event) => updateField("address2", event.target.value)}
                />

                <div className="shipping-address-form-row">
                    <s-text-field
                        label="City"
                        value={form.city}
                        required
                        onInput={(event) => updateField("city", event.target.value)}
                    />
                    <s-text-field
                        label={zipLabel}
                        value={form.zip}
                        required
                        onInput={(event) => updateField("zip", event.target.value)}
                    />
                </div>

                <div
                    className={`shipping-address-form-row${
                        showProvince ? "" : " shipping-address-form-row--single"
                    }`}
                >
                    <label className="shipping-address-select">
                        <span className="shipping-address-select__label">
                            Country/region <span aria-hidden="true">*</span>
                        </span>
                        <select
                            value={form.country_code}
                            onChange={(event) =>
                                updateField("country_code", event.target.value)
                            }
                        >
                            {countryOptions.map((country) => (
                                <option key={country.code} value={country.code}>
                                    {country.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    {showProvince && (
                        <label className="shipping-address-select">
                            <span className="shipping-address-select__label">
                                {provinceLabel}
                            </span>
                            <select
                                value={form.province_code}
                                onChange={(event) =>
                                    updateField("province_code", event.target.value)
                                }
                            >
                                <option value="">Select</option>
                                {provinces.map((province) => (
                                    <option key={province.code} value={province.code}>
                                        {province.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>

                <label className="shipping-phone-field">
                    <span className="shipping-address-select__label">Phone</span>
                    <div className="shipping-phone-field__control">
                        <span className="shipping-phone-field__prefix">
                            {getCallingCodeLabel(form.country_code)}
                        </span>
                        <input
                            type="tel"
                            className="shipping-phone-field__input"
                            value={form.phone}
                            placeholder="3001234567"
                            inputMode="numeric"
                            onChange={(event) =>
                                updateField(
                                    "phone",
                                    event.target.value.replace(/[^\d\s\-()]/g, "")
                                )
                            }
                        />
                    </div>
                    <span className="shipping-phone-field__hint">
                        Shopify needs E.164 format (e.g.{" "}
                        {getCallingCodeLabel(form.country_code)}3001234567). Leading 0 is
                        removed automatically.
                    </span>
                </label>
            </s-stack>

            <s-button
                slot="secondary-actions"
                variant="secondary"
                commandFor={EDIT_MODAL_ID}
                command="--hide"
                disabled={saving}
                onClick={close}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={saving}
                disabled={!canSave || saving}
                onClick={submit}
            >
                Save
            </s-button>
        </s-modal>
    );

    return { open, modal };
}

export function ShippingAddressCard({
    shipping,
    customerAdminUrl,
    onSelectDifferent,
    onManageCustomer,
    onEditManually,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const lines = formatShippingAddress(shipping);

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
                <h3 className="subscription-card__title">Shipping address</h3>
                <div className="payment-method-menu" ref={menuRef}>
                    <button
                        type="button"
                        className="payment-method-menu__trigger"
                        aria-label="Shipping address actions"
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        ⋮
                    </button>
                    {menuOpen && (
                        <div className="payment-method-menu__dropdown">
                            <button
                                type="button"
                                className="payment-method-menu__item"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onSelectDifferent?.();
                                }}
                            >
                                Select a different address
                            </button>
                            <button
                                type="button"
                                className="payment-method-menu__item"
                                disabled={!customerAdminUrl}
                                onClick={() => {
                                    setMenuOpen(false);
                                    onManageCustomer?.();
                                }}
                            >
                                Manage addresses on customer page
                            </button>
                            <button
                                type="button"
                                className="payment-method-menu__item"
                                onClick={() => {
                                    setMenuOpen(false);
                                    onEditManually?.();
                                }}
                            >
                                Manually edit address
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="subscription-card__body">
                {lines ? (
                    lines.map((line) => (
                        <p key={line} className="subscription-address-line">
                            {line}
                        </p>
                    ))
                ) : (
                    <p className="subscription-address-line">No shipping address saved.</p>
                )}
            </div>
        </div>
    );
}
