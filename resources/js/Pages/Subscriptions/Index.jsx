import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SubscriptionsIndexSkeleton } from "@/Components/Skeletons";
import { useSubscriptions } from "@/hooks/subscriptions/useSubscriptions";
import { SUBSCRIPTION_STATUS_TABS } from "@/constants/subscriptionConstants";
import {
    formatDateTime,
    formatMoney,
    formatSubscriptionStatus,
    getSubscriptionStatusTone,
    goToSubscriptionCreate,
    goToSubscriptionDetail,
} from "@/utils/subscriptionHelpers";
import "@/styles/subscriptions.css";
import "@/styles/skeleton.css";

function getTabBadgeCount(tabId, stats) {
    switch (tabId) {
        case "all":
            return stats.all;
        case "active":
            return stats.active;
        case "paused":
            return stats.paused;
        case "cancelled":
            return stats.cancelled;
        case "failed":
            return stats.failed;
        case "upcoming":
            return stats.upcoming;
        case "pending_payment":
            return stats.pending_payment;
        default:
            return 0;
    }
}

function getInitials(name) {
    if (!name) {
        return "?";
    }

    const parts = String(name).trim().split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function SubscriptionStatCard({ label, value, variant, active, onClick }) {
    return (
        <button
            type="button"
            className={`subscription-stat-card subscription-stat-card--${variant}${
                active ? " subscription-stat-card--selected" : ""
            }`}
            onClick={onClick}
        >
            <span className="subscription-stat-card__value">{value ?? 0}</span>
            <span className="subscription-stat-card__label">{label}</span>
        </button>
    );
}

export default function SubscriptionsIndex() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchInput, setSearchInput] = useState("");

    const filters = useMemo(
        () => ({
            search,
            status: statusFilter,
        }),
        [search, statusFilter]
    );

    const { subscriptions, stats, loading } = useSubscriptions(filters);

    const handleSearch = () => {
        setSearch(searchInput.trim());
    };

    const clearSearch = () => {
        setSearchInput("");
        setSearch("");
    };

    const highlightStats = [
        { id: "all", label: "All contracts", variant: "total" },
        { id: "active", label: "Active", variant: "active" },
        { id: "upcoming", label: "Upcoming", variant: "upcoming" },
        { id: "failed", label: "Failed payment", variant: "failed" },
        { id: "pending_payment", label: "Pending payment", variant: "pending" },
    ];

    return (
        <div className="subscriptions-page">
            <s-page heading="Subscriptions">
                <s-button
                    slot="primary-action"
                    variant="primary"
                    onClick={() => goToSubscriptionCreate(navigate)}
                >
                    Create subscription
                </s-button>
                {loading ? (
                    <SubscriptionsIndexSkeleton />
                ) : (
                    <s-stack direction="block" gap="base">
                        <div className="subscriptions-hero subscriptions-hero--vivid">
                            <div className="subscriptions-hero__content">
                                <s-badge tone="success">Live contracts</s-badge>
                                <h2 className="subscriptions-hero__title">
                                    Manage customer subscriptions
                                </h2>
                                <p className="subscriptions-hero__subtitle">
                                    Track active contracts, upcoming billings, failed payments, and
                                    open any subscription to manage billing, shipping, and discounts.
                                </p>
                            </div>
                            <div className="subscriptions-hero__aside">
                                <div className="subscriptions-hero__metric">
                                    <span className="subscriptions-hero__metric-value">
                                        {stats.active ?? 0}
                                    </span>
                                    <span className="subscriptions-hero__metric-label">
                                        Active now
                                    </span>
                                </div>
                                <div className="subscriptions-hero__metric">
                                    <span className="subscriptions-hero__metric-value">
                                        {stats.upcoming ?? 0}
                                    </span>
                                    <span className="subscriptions-hero__metric-label">
                                        Upcoming
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="subscriptions-stats">
                            {highlightStats.map((item) => (
                                <SubscriptionStatCard
                                    key={item.id}
                                    label={item.label}
                                    value={getTabBadgeCount(item.id, stats)}
                                    variant={item.variant}
                                    active={statusFilter === item.id}
                                    onClick={() => setStatusFilter(item.id)}
                                />
                            ))}
                        </div>

                        <div className="subscriptions-panel">
                            <div
                                className="subscriptions-chips"
                                role="tablist"
                                aria-label="Subscription filters"
                            >
                                {SUBSCRIPTION_STATUS_TABS.map((tab) => {
                                    const count = getTabBadgeCount(tab.id, stats);
                                    const isActive = statusFilter === tab.id;

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            className={`subscriptions-chip${
                                                isActive ? " subscriptions-chip--active" : ""
                                            }`}
                                            onClick={() => setStatusFilter(tab.id)}
                                        >
                                            <span>{tab.label}</span>
                                            <span className="subscriptions-chip__count">
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="subscriptions-toolbar">
                                <s-search-field
                                    label="Search subscriptions"
                                    labelAccessibilityVisibility="exclusive"
                                    placeholder="Search by email, subscription ID, customer name, product title or SKU"
                                    value={searchInput}
                                    onInput={(event) => setSearchInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            handleSearch();
                                        }
                                    }}
                                />

                                <s-button
                                    onClick={clearSearch}
                                    disabled={!searchInput && !search}
                                >
                                    Clear
                                </s-button>

                                <s-button variant="primary" onClick={handleSearch}>
                                    Search
                                </s-button>
                            </div>

                            <div className="subscriptions-summary-row">
                                <p className="subscriptions-summary">
                                    {`${subscriptions.length} subscription${
                                        subscriptions.length === 1 ? "" : "s"
                                    } in view`}
                                </p>
                                {statusFilter !== "all" && (
                                    <s-button
                                        variant="tertiary"
                                        onClick={() => setStatusFilter("all")}
                                    >
                                        Clear filter
                                    </s-button>
                                )}
                            </div>

                            {subscriptions.length === 0 ? (
                                <div className="subscriptions-empty">
                                    <div
                                        className="subscriptions-empty__icon"
                                        aria-hidden="true"
                                    >
                                        ⌕
                                    </div>
                                    <h3 className="subscriptions-empty__title">
                                        No subscriptions found
                                    </h3>
                                    <p className="subscriptions-empty__text">
                                        Try another filter, or wait for Shopify subscription
                                        contracts to sync into the app.
                                    </p>
                                </div>
                            ) : (
                                <div className="subscriptions-list">
                                    {subscriptions.map((subscription) => (
                                        <article
                                            key={subscription.id}
                                            className="subscription-card-row"
                                            onClick={() =>
                                                goToSubscriptionDetail(
                                                    navigate,
                                                    subscription.id
                                                )
                                            }
                                        >
                                            <div className="subscription-card-row__identity">
                                                <div
                                                    className="subscription-card-row__avatar"
                                                    aria-hidden="true"
                                                >
                                                    {getInitials(subscription.customer_name)}
                                                </div>
                                                <div className="subscription-card-row__customer">
                                                    <div className="subscription-card-row__title-line">
                                                        <span className="subscription-card-row__name">
                                                            {subscription.customer_name}
                                                        </span>
                                                        <s-badge
                                                            tone={getSubscriptionStatusTone(
                                                                subscription.status
                                                            )}
                                                        >
                                                            {formatSubscriptionStatus(
                                                                subscription.status
                                                            )}
                                                        </s-badge>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="subscription-card-row__id"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            goToSubscriptionDetail(
                                                                navigate,
                                                                subscription.id
                                                            );
                                                        }}
                                                    >
                                                        {subscription.reference}
                                                    </button>
                                                    <span className="subscription-card-row__email">
                                                        {subscription.customer_email ||
                                                            "No email"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="subscription-card-row__meta">
                                                <span className="subscription-card-row__meta-label">
                                                    Schedule
                                                </span>
                                                <span className="subscription-card-row__meta-value">
                                                    {subscription.frequency_label || "—"}
                                                </span>
                                                <span className="subscription-card-row__meta-sub">
                                                    {subscription.subscription_type}
                                                </span>
                                            </div>

                                            <div className="subscription-card-row__meta">
                                                <span className="subscription-card-row__meta-label">
                                                    Next billing
                                                </span>
                                                <span className="subscription-card-row__meta-value">
                                                    {subscription.next_billing_date
                                                        ? formatDateTime(
                                                              subscription.next_billing_date
                                                          )
                                                        : "—"}
                                                </span>
                                                <span className="subscription-card-row__meta-sub">
                                                    Created{" "}
                                                    {formatDateTime(subscription.created_at)}
                                                </span>
                                            </div>

                                            <div className="subscription-card-row__finance">
                                                <span className="subscription-card-row__meta-label">
                                                    {subscription.items_count} item
                                                    {subscription.items_count === 1 ? "" : "s"}
                                                </span>
                                                <span className="subscription-card-row__total">
                                                    {formatMoney(
                                                        subscription.total_amount,
                                                        subscription.currency_code
                                                    )}
                                                </span>
                                                <s-button
                                                    variant="secondary"
                                                    icon="view"
                                                    accessibilityLabel={`View subscription ${subscription.reference}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        goToSubscriptionDetail(
                                                            navigate,
                                                            subscription.id
                                                        );
                                                    }}
                                                >
                                                    View
                                                </s-button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </s-stack>
                )}
            </s-page>
        </div>
    );
}
