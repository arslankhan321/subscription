export default function PlanInfoBanner() {
    return (
        <s-banner tone="info">
            <s-paragraph>
                <s-text type="strong">Note:</s-text> Modifying or deleting the plan
                won't affect existing subscriptions — changes will only apply to
                new subscriptions.
            </s-paragraph>
            <s-paragraph>
                <s-text type="strong">Exception:</s-text> Changes to{" "}
                <s-text type="strong">product swap</s-text> and{" "}
                <s-text type="strong">automatic actions</s-text> settings apply to
                both existing and new subscriptions.{" "}
                <s-link href="#">Learn more</s-link>
            </s-paragraph>
        </s-banner>
    );
}
