export default function SubscriptionActivityLog({ logs = [] }) {
    if (!logs.length) {
        return (
            <div className="subscription-card">
                <div className="subscription-card__header">
                    <h3 className="subscription-card__title">Subscription log</h3>
                </div>
                <div className="subscription-card__body">
                    <p className="subscription-address-line">No activity logged yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="subscription-card">
            <div className="subscription-card__header">
                <h3 className="subscription-card__title">Subscription log</h3>
            </div>
            <div className="subscription-card__body">
                <ol className="subscription-activity-log" aria-label="Subscription activity">
                    {logs.map((log) => (
                        <li key={log.id} className="subscription-activity-log__item">
                            <span className="subscription-activity-log__dot" aria-hidden="true" />
                            <div className="subscription-activity-log__content">
                                <p className="subscription-activity-log__message">{log.message}</p>
                                <time
                                    className="subscription-activity-log__time"
                                    dateTime={log.created_at || undefined}
                                >
                                    {log.created_at || "—"}
                                </time>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
