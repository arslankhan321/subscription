import { useMemo } from "react";
import ProductGroupCard from "./ProductGroupCard";
import { groupProductsByParent } from "@/utils/productHelpers";

export default function ProductSelector({
    products,
    onSelectProducts,
    onRemoveProduct,
    onRemoveProductGroup,
    fieldErrors = {},
}) {
    const groups = useMemo(() => groupProductsByParent(products), [products]);

    return (
        <s-stack direction="block" gap="base">
            {fieldErrors.products && (
                <s-text tone="critical">{fieldErrors.products}</s-text>
            )}

            {groups.length === 0 ? (
                <s-box padding="base" background="subdued" borderRadius="base">
                    <s-stack direction="block" gap="small-200" alignItems="center">
                        <s-text tone="subdued">No products selected yet.</s-text>
                        <s-text tone="subdued">Pick products from your Shopify store to attach to this plan.</s-text>
                    </s-stack>
                </s-box>
            ) : (
                <div className="plan-product-list__scroll">
                    {groups.map((group) => (
                        <ProductGroupCard
                            key={group.id}
                            group={group}
                            onRemoveVariant={onRemoveProduct}
                            onRemoveGroup={onRemoveProductGroup}
                        />
                    ))}
                </div>
            )}

            <s-button onClick={onSelectProducts} icon="product" variant={products.length ? "secondary" : "primary"}>
                {products.length ? "Change products" : "Select products"}
            </s-button>
        </s-stack>
    );
}
