export default function PlanFormLoader({ message = "Loading plan..." }) {
    return (
        <div className="page-loader" role="status" aria-live="polite" aria-label={message}>
            <span className="page-loader__spinner page-loader__spinner--lg" aria-hidden="true" />
            <p className="page-loader__text">{message}</p>
        </div>
    );
}
