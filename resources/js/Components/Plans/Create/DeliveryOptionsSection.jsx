import DeliveryOptionCard from "./DeliveryOptionCard";

export default function DeliveryOptionsSection({
    deliveryOptions,
    deliveryOptionErrors = [],
    sectionError,
    onUpdate,
    onToggleCollapsed,
    onDuplicate,
    onRemove,
    onAdd,
}) {
    return (
        <s-stack direction="block" gap="base">
            {sectionError && <s-text tone="critical">{sectionError}</s-text>}

            {deliveryOptions.map((option, index) => (
                <DeliveryOptionCard
                    key={option.id}
                    option={option}
                    index={index}
                    fieldErrors={deliveryOptionErrors[index] ?? {}}
                    canRemove={deliveryOptions.length > 1}
                    onUpdate={onUpdate}
                    onToggleCollapsed={onToggleCollapsed}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                />
            ))}

            <s-button onClick={onAdd} icon="plus">
                Add delivery option
            </s-button>
        </s-stack>
    );
}
