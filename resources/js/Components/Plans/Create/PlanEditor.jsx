export default function PlanEditor({
    planName,
    fieldErrors = {},
    onPlanNameChange,
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
        </s-stack>
    );
}
