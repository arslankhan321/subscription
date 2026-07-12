import "@/styles/skeleton.css";

export function SkeletonBlock({ width = "100%", height = 16, radius = 8, className = "" }) {
    return (
        <span
            className={`skeleton-block ${className}`.trim()}
            style={{ width, height, borderRadius: radius }}
            aria-hidden="true"
        />
    );
}

export function SkeletonLine({ width = "100%", height = 12 }) {
    return <SkeletonBlock width={width} height={height} radius={6} />;
}

export function SkeletonCircle({ size = 44 }) {
    return <SkeletonBlock width={size} height={size} radius="999px" />;
}

export function SubscriptionsIndexSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading subscriptions">
            <div className="skeleton-hero">
                <div className="skeleton-stack">
                    <SkeletonBlock width={90} height={22} radius={999} />
                    <SkeletonBlock width="55%" height={28} />
                    <SkeletonLine width="75%" height={14} />
                    <SkeletonLine width="60%" height={14} />
                </div>
                <div className="skeleton-hero__aside">
                    <SkeletonBlock width={100} height={72} radius={14} />
                    <SkeletonBlock width={100} height={72} radius={14} />
                </div>
            </div>

            <div className="skeleton-stats">
                {Array.from({ length: 5 }).map((_, index) => (
                    <SkeletonBlock key={index} height={84} radius={16} />
                ))}
            </div>

            <div className="skeleton-panel">
                <div className="skeleton-chips">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <SkeletonBlock key={index} width={110} height={32} radius={999} />
                    ))}
                </div>
                <SkeletonBlock height={44} radius={12} />
                <div className="skeleton-list">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="skeleton-subscription-row">
                            <div className="skeleton-subscription-row__left">
                                <SkeletonCircle size={44} />
                                <div className="skeleton-stack">
                                    <SkeletonBlock width="55%" height={16} />
                                    <SkeletonLine width="35%" />
                                    <SkeletonLine width="45%" />
                                </div>
                            </div>
                            <div className="skeleton-stack">
                                <SkeletonLine width="40%" height={10} />
                                <SkeletonBlock width="70%" height={16} />
                                <SkeletonLine width="50%" />
                            </div>
                            <div className="skeleton-stack">
                                <SkeletonLine width="40%" height={10} />
                                <SkeletonBlock width="75%" height={16} />
                                <SkeletonLine width="55%" />
                            </div>
                            <div className="skeleton-stack skeleton-stack--end">
                                <SkeletonLine width={70} height={10} />
                                <SkeletonBlock width={90} height={20} />
                                <SkeletonBlock width={72} height={32} radius={10} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SubscriptionShowSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading subscription">
            <div className="skeleton-detail-header">
                <div className="skeleton-stack">
                    <SkeletonBlock width="40%" height={28} />
                    <SkeletonBlock width={80} height={24} radius={999} />
                </div>
                <div className="skeleton-inline">
                    <SkeletonBlock width={120} height={36} radius={10} />
                    <SkeletonBlock width={120} height={36} radius={10} />
                    <SkeletonBlock width={140} height={36} radius={10} />
                </div>
            </div>

            <div className="skeleton-detail-grid">
                <div className="skeleton-stack">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="skeleton-card">
                            <SkeletonBlock width="30%" height={18} />
                            <SkeletonLine width="90%" />
                            <SkeletonLine width="70%" />
                            <SkeletonLine width="80%" />
                        </div>
                    ))}
                </div>
                <div className="skeleton-stack">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="skeleton-card">
                            <SkeletonBlock width="45%" height={18} />
                            <SkeletonLine width="85%" />
                            <SkeletonLine width="65%" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SubscriptionEditSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading edit subscription">
            <div className="skeleton-detail-header">
                <SkeletonBlock width="45%" height={28} />
                <div className="skeleton-inline">
                    <SkeletonBlock width={90} height={36} radius={10} />
                    <SkeletonBlock width={90} height={36} radius={10} />
                </div>
            </div>

            <div className="skeleton-detail-grid">
                <div className="skeleton-stack">
                    <div className="skeleton-card">
                        <SkeletonBlock width="40%" height={18} />
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="skeleton-edit-line">
                                <SkeletonCircle size={48} />
                                <div className="skeleton-stack">
                                    <SkeletonBlock width="60%" height={16} />
                                    <SkeletonLine width="40%" />
                                </div>
                                <SkeletonBlock width={72} height={40} radius={10} />
                                <SkeletonBlock width={96} height={40} radius={10} />
                            </div>
                        ))}
                    </div>
                    <div className="skeleton-card">
                        <SkeletonBlock width="50%" height={18} />
                        <SkeletonBlock height={40} radius={10} />
                        <div className="skeleton-inline">
                            <SkeletonBlock height={40} radius={10} />
                            <SkeletonBlock height={40} radius={10} />
                        </div>
                        <SkeletonBlock height={40} radius={10} />
                    </div>
                </div>
                <div className="skeleton-card">
                    <SkeletonBlock width="55%" height={18} />
                    <SkeletonLine width="100%" />
                    <SkeletonLine width="100%" />
                    <SkeletonBlock width="100%" height={1} radius={0} />
                    <SkeletonLine width="100%" height={18} />
                </div>
            </div>
        </div>
    );
}

export function PlansIndexSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading plans">
            <div className="skeleton-hero skeleton-hero--simple">
                <SkeletonBlock width="40%" height={24} />
                <SkeletonLine width="70%" />
            </div>
            <div className="skeleton-stats skeleton-stats--4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} height={84} radius={14} />
                ))}
            </div>
            <div className="skeleton-card">
                <div className="skeleton-inline">
                    <SkeletonBlock height={40} radius={10} />
                    <SkeletonBlock width={160} height={40} radius={10} />
                </div>
                <div className="skeleton-table">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="skeleton-table-row">
                            <SkeletonBlock width="28%" height={16} />
                            <SkeletonBlock width="12%" height={22} radius={999} />
                            <SkeletonLine width="10%" />
                            <SkeletonLine width="10%" />
                            <SkeletonBlock width="10%" height={22} radius={999} />
                            <SkeletonBlock width="12%" height={22} radius={999} />
                            <SkeletonBlock width="16%" height={32} radius={10} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function PlanFormSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading plan">
            <div className="skeleton-detail-grid">
                <div className="skeleton-stack">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="skeleton-card">
                            <SkeletonBlock width="35%" height={18} />
                            <SkeletonBlock height={40} radius={10} />
                            <SkeletonLine width="90%" />
                            <SkeletonLine width="70%" />
                            <div className="skeleton-inline">
                                <SkeletonBlock height={40} radius={10} />
                                <SkeletonBlock height={40} radius={10} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="skeleton-card">
                    <SkeletonBlock width="50%" height={18} />
                    <SkeletonLine width="100%" />
                    <SkeletonLine width="80%" />
                    <SkeletonLine width="90%" />
                    <SkeletonBlock height={36} radius={10} />
                    <SkeletonBlock height={36} radius={10} />
                </div>
            </div>
        </div>
    );
}

export function SettingsSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading settings">
            <div className="skeleton-card">
                <div className="skeleton-inline">
                    <SkeletonCircle size={36} />
                    <SkeletonBlock width={180} height={24} />
                </div>
                <SkeletonBlock height={40} radius={10} />
                <SkeletonBlock height={40} radius={10} />
                <SkeletonLine width="80%" />
                <div className="skeleton-inline">
                    <SkeletonBlock height={40} radius={10} />
                    <SkeletonBlock height={40} radius={10} />
                </div>
                <SkeletonBlock height={120} radius={12} />
            </div>
        </div>
    );
}

export function ShippingProfilesSkeleton() {
    return (
        <div className="skeleton-page skeleton-page--compact" aria-busy="true" aria-label="Loading shipping profiles">
            <div className="skeleton-list">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="skeleton-card">
                        <div className="skeleton-inline">
                            <div className="skeleton-stack">
                                <SkeletonBlock width="40%" height={18} />
                                <SkeletonLine width="55%" />
                            </div>
                            <SkeletonBlock width={110} height={32} radius={10} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ModalListSkeleton({ rows = 3 }) {
    return (
        <div className="skeleton-page skeleton-page--compact" aria-busy="true">
            <div className="skeleton-list">
                {Array.from({ length: rows }).map((_, index) => (
                    <div key={index} className="skeleton-card skeleton-card--tight">
                        <div className="skeleton-inline">
                            <SkeletonCircle size={28} />
                            <div className="skeleton-stack">
                                <SkeletonBlock width="60%" height={14} />
                                <SkeletonLine width="40%" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function EmailTemplatesSkeleton() {
    return (
        <div className="skeleton-page skeleton-page--compact" aria-busy="true" aria-label="Loading email templates">
            <SkeletonLine width="85%" height={12} />
            <div className="skeleton-list">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="skeleton-card skeleton-card--tight">
                        <div className="skeleton-inline">
                            <SkeletonCircle size={36} />
                            <div className="skeleton-stack">
                                <SkeletonBlock width="45%" height={16} />
                                <SkeletonLine width="30%" />
                            </div>
                            <SkeletonBlock width={48} height={24} radius={999} />
                            <SkeletonBlock width={72} height={32} radius={10} />
                            <SkeletonBlock width={72} height={32} radius={10} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function WidgetFormSkeleton() {
    return (
        <div className="skeleton-page" aria-busy="true" aria-label="Loading widget">
            <div className="skeleton-detail-grid">
                <div className="skeleton-card">
                    <SkeletonBlock width="40%" height={18} />
                    <SkeletonBlock height={40} radius={10} />
                    <SkeletonBlock height={40} radius={10} />
                    <SkeletonLine width="90%" />
                    <SkeletonBlock height={160} radius={12} />
                </div>
                <div className="skeleton-card">
                    <SkeletonBlock width="50%" height={18} />
                    <SkeletonBlock height={280} radius={12} />
                </div>
            </div>
        </div>
    );
}
