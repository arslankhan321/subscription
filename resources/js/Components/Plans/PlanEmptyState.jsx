export default function PlanEmptyState({ onCreate }) {
    return (
        <div className="plans-empty">
            <div className="plans-empty__icon" aria-hidden="true">
                📦
            </div>
            <h3 className="plans-empty__title">No subscription plans yet</h3>
            <p className="plans-empty__text">
                Create your first plan to start offering subscriptions to your customers.
            </p>
            <s-button variant="primary" onClick={onCreate}>
                Create your first plan
            </s-button>
        </div>
    );
}
