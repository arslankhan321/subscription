import { WIDGET_OPTIONS } from "@/constants/planConstants";

export default function PlanEditor({
    planName,
    widget,
    fieldErrors = {},
    onPlanNameChange,
    onWidgetChange,
}) {
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
                details="Visible to customers on the product page"
                error={fieldErrors.widget}
            >
                {WIDGET_OPTIONS.map((option) => (
                    <s-option key={option} value={option}>
                        {option}
                    </s-option>
                ))}
            </s-select>
        </s-stack>
    );
}
