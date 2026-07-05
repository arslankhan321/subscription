import {
    BILLING_TYPES,
    DELIVERY_INTERVALS,
    DISCOUNT_TYPES,
    MAX_ORDER_OPTIONS,
    ORDER_LIMIT_OPTIONS,
} from "@/constants/planConstants";
import { getBillingFrequencyOptions } from "@/utils/planHelpers";

export default function DeliveryOptionCard({
    option,
    index,
    canRemove,
    onUpdate,
    onToggleCollapsed,
    onDuplicate,
    onRemove,
}) {
    const discountSuffix = option.discountType === "Percentage off" ? "%" : "";

    return (
        <div className="plan-delivery-card">
            <div className="plan-delivery-card__head">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge>{index + 1}</s-badge>
                    <s-text type="strong">
                        {option.name?.trim() || `Option #${index + 1}`}
                    </s-text>
                </s-stack>

                <s-stack direction="inline" gap="small-200">
                    <s-button
                        icon="duplicate"
                        variant="tertiary"
                        accessibilityLabel="Duplicate option"
                        onClick={() => onDuplicate(option.id)}
                    />
                    <s-button
                        icon={option.collapsed ? "chevron-down" : "chevron-up"}
                        variant="tertiary"
                        accessibilityLabel="Collapse option"
                        onClick={() => onToggleCollapsed(option.id)}
                    />
                    {canRemove && (
                        <s-button
                            icon="delete"
                            variant="tertiary"
                            tone="critical"
                            accessibilityLabel="Remove option"
                            onClick={() => onRemove(option.id)}
                        />
                    )}
                </s-stack>
            </div>

            {!option.collapsed && (
                <div className="plan-delivery-card__body">
                    <s-stack direction="block" gap="base">
                        <s-text-field
                            label="Name"
                            value={option.name}
                            placeholder="e.g. Monthly delivery"
                            details="Leave empty to generate automatically"
                            onInput={(e) => onUpdate(option.id, { name: e.target.value })}
                        />

                        <s-select
                            label="Billing type"
                            value={option.billingType}
                            onChange={(e) => {
                                const value = e.target.value;
                                onUpdate(option.id, {
                                    billingType: value,
                                    ...(value === BILLING_TYPES.PREPAID
                                        ? {
                                              billingFrequency: option.deliveryFrequency,
                                              billingInterval: option.deliveryInterval,
                                          }
                                        : {}),
                                });
                            }}
                        >
                            <s-option value={BILLING_TYPES.PAY_AS_YOU_GO}>
                                Pay as you go
                            </s-option>
                            <s-option value={BILLING_TYPES.PREPAID}>Prepaid</s-option>
                        </s-select>

                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                            <s-grid-item>
                                <s-text-field
                                    label="Delivery frequency"
                                    type="number"
                                    min="1"
                                    value={option.deliveryFrequency}
                                    onInput={(e) => {
                                        const frequency = e.target.value;
                                        onUpdate(option.id, {
                                            deliveryFrequency: frequency,
                                            ...(option.billingType === BILLING_TYPES.PREPAID
                                                ? { billingFrequency: frequency }
                                                : {}),
                                        });
                                    }}
                                />
                            </s-grid-item>
                            <s-grid-item>
                                <s-select
                                    label="Delivery interval"
                                    value={option.deliveryInterval}
                                    onChange={(e) => {
                                        const interval = e.target.value;
                                        onUpdate(option.id, {
                                            deliveryInterval: interval,
                                            ...(option.billingType === BILLING_TYPES.PREPAID
                                                ? { billingInterval: interval }
                                                : {}),
                                        });
                                    }}
                                >
                                    {DELIVERY_INTERVALS.map((interval) => (
                                        <s-option key={interval} value={interval}>
                                            {interval}
                                        </s-option>
                                    ))}
                                </s-select>
                            </s-grid-item>

                            {option.billingType === BILLING_TYPES.PREPAID && (
                                <>
                                    <s-grid-item>
                                        <s-select
                                            label="Billing frequency"
                                            value={option.billingFrequency}
                                            onChange={(e) =>
                                                onUpdate(option.id, {
                                                    billingFrequency: e.target.value,
                                                })
                                            }
                                        >
                                            {getBillingFrequencyOptions(
                                                option.deliveryFrequency
                                            ).map((item) => (
                                                <s-option key={item.value} value={item.value}>
                                                    {item.label}
                                                </s-option>
                                            ))}
                                        </s-select>
                                    </s-grid-item>
                                    <s-grid-item>
                                        <s-select
                                            label="Billing interval"
                                            value={option.billingInterval}
                                            disabled
                                        >
                                            <s-option value={option.billingInterval}>
                                                {option.billingInterval}
                                            </s-option>
                                        </s-select>
                                    </s-grid-item>
                                </>
                            )}
                        </s-grid>

                        <s-divider />

                        <s-text type="strong">Subscription orders</s-text>
                        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                            <s-grid-item>
                                <s-select
                                    label="Minimum number of orders"
                                    value={option.minOrders}
                                    onChange={(e) =>
                                        onUpdate(option.id, { minOrders: e.target.value })
                                    }
                                >
                                    {ORDER_LIMIT_OPTIONS.map((value) => (
                                        <s-option key={value} value={value}>
                                            {value}
                                        </s-option>
                                    ))}
                                </s-select>
                            </s-grid-item>
                            <s-grid-item>
                                <s-select
                                    label="Maximum number of orders"
                                    value={option.maxOrders}
                                    onChange={(e) =>
                                        onUpdate(option.id, { maxOrders: e.target.value })
                                    }
                                >
                                    {MAX_ORDER_OPTIONS.map((value) => (
                                        <s-option key={value} value={value}>
                                            {value}
                                        </s-option>
                                    ))}
                                </s-select>
                            </s-grid-item>
                        </s-grid>

                        <s-divider />

                        <s-text type="strong">Subscription discount</s-text>
                        <s-checkbox
                            label="Give discount"
                            checked={option.giveDiscount}
                            onChange={(e) =>
                                onUpdate(option.id, { giveDiscount: e.target.checked })
                            }
                        />

                        {option.giveDiscount && (
                            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                                <s-grid-item>
                                    <s-text-field
                                        label="Discount amount"
                                        value={option.discountAmount}
                                        suffix={discountSuffix}
                                        onInput={(e) =>
                                            onUpdate(option.id, {
                                                discountAmount: e.target.value,
                                            })
                                        }
                                    />
                                </s-grid-item>
                                <s-grid-item>
                                    <s-select
                                        label="Discount type"
                                        value={option.discountType}
                                        onChange={(e) =>
                                            onUpdate(option.id, {
                                                discountType: e.target.value,
                                            })
                                        }
                                    >
                                        {DISCOUNT_TYPES.map((value) => (
                                            <s-option key={value} value={value}>
                                                {value}
                                            </s-option>
                                        ))}
                                    </s-select>
                                </s-grid-item>
                            </s-grid>
                        )}

                        <s-checkbox
                            label="Change discount after # of orders"
                            checked={option.changeDiscountAfterOrders}
                            onChange={(e) =>
                                onUpdate(option.id, {
                                    changeDiscountAfterOrders: e.target.checked,
                                })
                            }
                        />

                        {option.changeDiscountAfterOrders && (
                            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                                <s-grid-item>
                                    <s-text-field
                                        label="Discount amount"
                                        value={option.laterDiscountAmount}
                                        suffix={discountSuffix}
                                        onInput={(e) =>
                                            onUpdate(option.id, {
                                                laterDiscountAmount: e.target.value,
                                            })
                                        }
                                    />
                                </s-grid-item>
                                <s-grid-item>
                                    <s-text-field
                                        label="After # of orders"
                                        value={option.laterDiscountAfterOrders}
                                        onInput={(e) =>
                                            onUpdate(option.id, {
                                                laterDiscountAfterOrders: e.target.value,
                                            })
                                        }
                                    />
                                </s-grid-item>
                                <s-grid-item>
                                    <s-select
                                        label="Discount type"
                                        value={option.laterDiscountType}
                                        onChange={(e) =>
                                            onUpdate(option.id, {
                                                laterDiscountType: e.target.value,
                                            })
                                        }
                                    >
                                        {DISCOUNT_TYPES.map((value) => (
                                            <s-option key={value} value={value}>
                                                {value}
                                            </s-option>
                                        ))}
                                    </s-select>
                                </s-grid-item>
                            </s-grid>
                        )}

                        <s-divider />

                        <s-text type="strong">Shipping discount</s-text>
                        <s-checkbox
                            label="Give shipping discount"
                            checked={option.giveShippingDiscount}
                            onChange={(e) =>
                                onUpdate(option.id, {
                                    giveShippingDiscount: e.target.checked,
                                })
                            }
                        />

                        {option.giveShippingDiscount && (
                            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                                <s-grid-item>
                                    <s-text-field
                                        label="Discount"
                                        value={option.shippingDiscountAmount}
                                        details="This will be the new delivery price"
                                        onInput={(e) =>
                                            onUpdate(option.id, {
                                                shippingDiscountAmount: e.target.value,
                                            })
                                        }
                                    />
                                </s-grid-item>
                                <s-grid-item>
                                    <s-text-field
                                        label="After # of orders"
                                        value={option.shippingDiscountAfterOrders}
                                        details="After how many orders to change delivery price"
                                        onInput={(e) =>
                                            onUpdate(option.id, {
                                                shippingDiscountAfterOrders: e.target.value,
                                            })
                                        }
                                    />
                                </s-grid-item>
                                <s-grid-item>
                                    <s-select
                                        label="Discount type"
                                        value={option.shippingDiscountType}
                                        onChange={(e) =>
                                            onUpdate(option.id, {
                                                shippingDiscountType: e.target.value,
                                            })
                                        }
                                    >
                                        {DISCOUNT_TYPES.map((value) => (
                                            <s-option key={value} value={value}>
                                                {value}
                                            </s-option>
                                        ))}
                                    </s-select>
                                </s-grid-item>
                            </s-grid>
                        )}
                    </s-stack>
                </div>
            )}
        </div>
    );
}
