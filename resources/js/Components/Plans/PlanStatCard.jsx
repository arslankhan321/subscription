export default function PlanStatCard({ value, label, variant = "total" }) {
    return (
        <div className={`plan-stat-card plan-stat-card--${variant}`}>
            <p className="plan-stat-card__value">{value}</p>
            <p className="plan-stat-card__label">{label}</p>
        </div>
    );
}
