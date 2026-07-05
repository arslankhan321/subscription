import { useCallback, useState } from "react";
import { showToast } from "@/utils/shopifyToast";
import { getProductKey } from "@/utils/productHelpers";

function buildSelectionIds(products) {
    const byProduct = new Map();

    for (const product of products) {
        if (!byProduct.has(product.id)) {
            byProduct.set(product.id, { id: product.id, variants: [] });
        }

        if (product.variantId) {
            byProduct.get(product.id).variants.push({ id: product.variantId });
        }
    }

    return Array.from(byProduct.values()).map((entry) => {
        if (entry.variants.length === 0) {
            return { id: entry.id };
        }

        return entry;
    });
}

function mapPickerSelection(selected) {
    return selected.flatMap((product) => {
        const variants = product.variants?.length ? product.variants : [null];

        return variants.map((variant) => {
            const variantTitle = variant?.displayName || variant?.title || null;

            return {
                id: product.id,
                productTitle: product.title,
                variantTitle,
                title: variantTitle ? `${product.title} — ${variantTitle}` : product.title,
                image:
                    variant?.image?.originalSrc ||
                    product.images?.[0]?.originalSrc ||
                    null,
                variantId: variant?.id ?? null,
            };
        });
    });
}

export function useProductPicker(initialProducts = []) {
    const [products, setProducts] = useState(initialProducts);

    const removeProduct = useCallback((key) => {
        setProducts((prev) => prev.filter((item) => getProductKey(item) !== key));
    }, []);

    const removeProductGroup = useCallback((productId) => {
        setProducts((prev) => prev.filter((item) => item.id !== productId));
    }, []);

    const handleSelectProducts = useCallback(async () => {
        if (!window.shopify?.resourcePicker) {
            showToast("Product picker is not available.", { isError: true });
            return;
        }

        const selected = await window.shopify.resourcePicker({
            type: "product",
            multiple: true,
            selectionIds: buildSelectionIds(products),
        });

        if (!selected?.length) return;

        setProducts(mapPickerSelection(selected));
    }, [products]);

    return {
        products,
        setProducts,
        removeProduct,
        removeProductGroup,
        handleSelectProducts,
    };
}
