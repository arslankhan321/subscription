import { useState } from "react";
import { VARIANT_LIST_VISIBLE_COUNT } from "@/utils/productHelpers";

export default function ProductGroupCard({
    group,
    onRemoveVariant,
    onRemoveGroup,
}) {
    const [expanded, setExpanded] = useState(false);
    const [visibleVariantCount, setVisibleVariantCount] = useState(VARIANT_LIST_VISIBLE_COUNT);

    const variantCount = group.variants.length;
    const hasMultipleVariants = variantCount > 1;
    const visibleVariants = group.variants.slice(0, visibleVariantCount);
    const hiddenVariantCount = variantCount - visibleVariants.length;

    const toggleExpanded = () => {
        if (!hasMultipleVariants) return;
        setExpanded((prev) => !prev);
    };

    const handleRemove = (event) => {
        event.stopPropagation();

        if (hasMultipleVariants) {
            onRemoveGroup(group.id);
            return;
        }

        const variant = group.variants[0];
        onRemoveVariant(variant?.variantId || group.id);
    };

    const handleRemoveVariant = (event, variant) => {
        event.stopPropagation();
        onRemoveVariant(variant.variantId || group.id);
    };

    return (
        <div className={`plan-product-group${expanded ? " plan-product-group--expanded" : ""}`}>
            <div
                className={`plan-product-card${hasMultipleVariants ? " plan-product-card--expandable" : ""}`}
                onClick={toggleExpanded}
                role={hasMultipleVariants ? "button" : undefined}
                tabIndex={hasMultipleVariants ? 0 : undefined}
                onKeyDown={(event) => {
                    if (!hasMultipleVariants) return;
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleExpanded();
                    }
                }}
            >
                {hasMultipleVariants && (
                    <span
                        className={`plan-product-card__chevron${expanded ? " plan-product-card__chevron--open" : ""}`}
                        aria-hidden="true"
                    >
                        ›
                    </span>
                )}

                <div className="plan-product-card__info">
                    <s-thumbnail
                        src={group.image || undefined}
                        alt={group.productTitle}
                        size="small"
                    />
                    <span className="plan-product-card__title">{group.productTitle}</span>
                    {hasMultipleVariants && (
                        <span className="plan-product-card__count">{variantCount} variants</span>
                    )}
                </div>

                <s-button
                    icon="delete"
                    variant="tertiary"
                    tone="critical"
                    accessibilityLabel={`Remove ${group.productTitle}`}
                    onClick={handleRemove}
                />
            </div>

            {hasMultipleVariants && expanded && (
                <div className="plan-product-group__variants">
                    {visibleVariants.map((variant) => (
                        <div key={variant.variantId || group.id} className="plan-product-card plan-product-card--variant">
                            <div className="plan-product-card__info">
                                <span className="plan-product-card__title">{variant.variantTitle}</span>
                            </div>

                            <s-button
                                icon="delete"
                                variant="tertiary"
                                tone="critical"
                                accessibilityLabel={`Remove ${variant.variantTitle}`}
                                onClick={(event) => handleRemoveVariant(event, variant)}
                            />
                        </div>
                    ))}

                    {hiddenVariantCount > 0 && (
                        <s-button
                            variant="tertiary"
                            onClick={() =>
                                setVisibleVariantCount((count) => count + VARIANT_LIST_VISIBLE_COUNT)
                            }
                        >
                            Load more variants ({hiddenVariantCount} remaining)
                        </s-button>
                    )}
                </div>
            )}
        </div>
    );
}
