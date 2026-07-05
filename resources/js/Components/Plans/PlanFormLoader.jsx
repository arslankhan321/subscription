export default function PlanFormLoader({ message = "Loading plan..." }) {
    return (
        <div className="plan-form-loader">
            <span className="plan-form-loader__spinner" aria-hidden="true" />
            <p className="plan-form-loader__text">{message}</p>
        </div>
    );
}
