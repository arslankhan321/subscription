export default function PageLoader({
    label = "Loading",
    message = null,
    size = "large",
    compact = false,
}) {
    const sizeClass =
        size === "small" || size === "base" ? "page-loader__spinner--sm" : "page-loader__spinner--lg";

    return (
        <div
            className={`page-loader${compact ? " page-loader--compact" : ""}`}
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <span className={`page-loader__spinner ${sizeClass}`} aria-hidden="true" />
            {message ? <p className="page-loader__text">{message}</p> : null}
        </div>
    );
}
