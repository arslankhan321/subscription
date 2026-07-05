export default function PlanValidationBanner({ errors = [] }) {
    if (!errors.length) {
        return null;
    }

    return (
        <div id="plan-validation-banner" className="plan-validation-banner">
            <s-banner tone="critical" heading="Please fix the following before saving">
                <s-unordered-list>
                    {errors.map((error) => (
                        <s-list-item key={error}>{error}</s-list-item>
                    ))}
                </s-unordered-list>
            </s-banner>
        </div>
    );
}
