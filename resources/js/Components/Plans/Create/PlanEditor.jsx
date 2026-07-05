import { useActiveWidgets } from "@/hooks/widgets/useActiveWidgets";

export default function PlanEditor({
    planName,
    widget,
    fieldErrors = {},
    onPlanNameChange,
    onWidgetChange,
}) {
    const { widgetOptions, loading } = useActiveWidgets();

    return (
        <s-stack direction="block" gap="base">
            <s-text-field
                label="Plan name (internal)"
                value={planName}
                onInput={(e) => onPlanNameChange(e.target.value)}
                details="For your reference only — customers won't see this name"
                required
                error={fieldErrors.planName}
            />

            <s-select
                label="Widget assigned"
                value={widget}
                onChange={(e) => onWidgetChange(e.target.value)}
                details={
                    loading
                        ? "Loading widgets..."
                        : "Visible to customers on the product page. Create widgets under Widgets menu."
                }
                error={fieldErrors.widget}
            >
                {widgetOptions.map((option) => (
                    <s-option key={option.value} value={option.value}>
                        {option.label}
                    </s-option>
                ))}
            </s-select>

            {!loading && widgetOptions.length <= 1 && (
                <s-text tone="subdued">
                    No active widgets yet. Go to Widgets → Create widget → Publish, then assign it here.
                </s-text>
            )}
        </s-stack>
    );
}
