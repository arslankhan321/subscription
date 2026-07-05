export default function ProductCard({ product, onRemove, nested = false }) {
    return (
        <div className={`plan-product-card${nested ? " plan-product-card--nested" : ""}`}>
            <div className="plan-product-card__info">
                {!nested && (
                    <s-thumbnail
                        src={product.image || undefined}
                        alt={product.title}
                        size="small"
                    />
                )}
                <span className="plan-product-card__title">{product.title}</span>
            </div>

            <s-button
                icon="delete"
                variant="tertiary"
                tone="critical"
                accessibilityLabel={`Remove ${product.title}`}
                onClick={() => onRemove(product.variantId || product.id)}
            />
        </div>
    );
}
