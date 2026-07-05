export const PRODUCT_LIST_VISIBLE_COUNT = 5;
export const VARIANT_LIST_VISIBLE_COUNT = 5;

function normalizeShopifyId(id) {
    if (id == null) return id;
    const value = String(id);
    return value.includes("/") ? value.split("/").pop() : value;
}

export function normalizeProductItem(product) {
    if (product.productTitle) {
        return product;
    }

    if (product.variantId && product.title?.includes(" — ")) {
        const [productTitle, ...rest] = product.title.split(" — ");

        return {
            ...product,
            productTitle,
            variantTitle: rest.join(" — "),
        };
    }

    return {
        ...product,
        productTitle: product.title,
        variantTitle: null,
    };
}

export function groupProductsByParent(products) {
    const groups = new Map();

    for (const raw of products) {
        const product = normalizeProductItem(raw);
        const groupKey = normalizeShopifyId(product.id);

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                id: product.id,
                productTitle: product.productTitle,
                image: product.image,
                variants: [],
            });
        }

        const group = groups.get(groupKey);

        if (product.variantId) {
            const variantKey = normalizeShopifyId(product.variantId);
            const exists = group.variants.some(
                (item) => normalizeShopifyId(item.variantId) === variantKey
            );
            if (exists) continue;

            group.variants.push({
                variantId: product.variantId,
                variantTitle: product.variantTitle || product.title,
                image: product.image,
            });
        } else {
            group.variants.push({
                variantId: null,
                variantTitle: product.productTitle,
                image: product.image,
            });
        }

        if (!group.image && product.image) {
            group.image = product.image;
        }
    }

    return Array.from(groups.values());
}

export function getProductKey(product) {
    return product.variantId || product.id;
}
