import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscriptions } from "@/hooks/subscriptions/useSubscriptions";
import { SUBSCRIPTION_STATUS_TABS } from "@/constants/subscriptionConstants";
import {
    formatDateTime,
    formatMoney,
    formatSubscriptionStatus,
    getSubscriptionStatusTone,
    goToSubscriptionDetail,
} from "@/utils/subscriptionHelpers";
import "@/styles/subscriptions.css";

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

function getTabBadgeClass(tabId) {
    if (tabId === "active") {
        return "subscriptions-tab__badge subscriptions-tab__badge--active";
    }

    if (tabId === "paused") {
        return "subscriptions-tab__badge subscriptions-tab__badge--paused";
    }

    return "subscriptions-tab__badge";
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

    return (
        <div className="subscriptions-page">
            <s-page heading="Subscriptions">
                <s-stack direction="block" gap="base">
                    <div className="subscriptions-hero">
                        <h2 className="subscriptions-hero__title">Manage customer subscriptions</h2>
                        <p className="subscriptions-hero__subtitle">
                            Track active contracts, upcoming billings, failed payments, and open any
                            subscription to view billing schedules from Shopify.
                        </p>
                    </div>

                    <div className="subscriptions-tabs" role="tablist" aria-label="Subscription filters">
                        {SUBSCRIPTION_STATUS_TABS.map((tab) => {
                            const count = getTabBadgeCount(tab.id, stats);
                            const isActive = statusFilter === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`subscriptions-tab${isActive ? " subscriptions-tab--active" : ""}`}
                                    onClick={() => setStatusFilter(tab.id)}
                                >
                                    <span>{tab.label}</span>
                                    {count > 0 && (
                                        <span className={getTabBadgeClass(tab.id)}>{count}</span>
                                    )}
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

                        <s-button onClick={clearSearch} disabled={!searchInput && !search}>
                            Clear
                        </s-button>

                        <s-button variant="primary" onClick={handleSearch}>
                            Search
                        </s-button>
                    </div>

                    <p className="subscriptions-summary">
                        {loading
                            ? "Loading subscriptions..."
                            : `Showing ${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"}`}
                    </p>

                    {loading ? (
                        <s-box padding="large">
                            <s-spinner accessibilityLabel="Loading subscriptions" size="large" />
                        </s-box>
                    ) : subscriptions.length === 0 ? (
                        <div className="subscriptions-empty">
                            <h3 className="subscriptions-empty__title">No subscriptions found</h3>
                            <p className="subscriptions-empty__text">
                                New Shopify subscription contracts will appear here after the webhook sync
                                runs.
                            </p>
                        </div>
                    ) : (
                        <div className="subscriptions-list">
                            {subscriptions.map((subscription) => (
                                <article key={subscription.id} className="subscription-row">
                                    <button
                                        type="button"
                                        className="subscription-row__id"
                                        onClick={() => goToSubscriptionDetail(navigate, subscription.id)}
                                    >
                                        {subscription.reference}
                                    </button>

                                    <div className="subscription-row__customer">
                                        <span className="subscription-row__name">
                                            {subscription.customer_name}
                                        </span>
                                        <span className="subscription-row__email">
                                            {subscription.customer_email || "No email"}
                                        </span>
                                        <s-badge tone={getSubscriptionStatusTone(subscription.status)}>
                                            {formatSubscriptionStatus(subscription.status)}
                                        </s-badge>
                                    </div>

                                    <div className="subscription-row__meta">
                                        <span>Created: {formatDateTime(subscription.created_at)}</span>
                                        <span>{subscription.subscription_type}</span>
                                        <span>{subscription.frequency_label || "—"}</span>
                                    </div>

                                    <div className="subscription-row__meta">
                                        <span>
                                            {subscription.items_count} item
                                            {subscription.items_count === 1 ? "" : "s"}
                                        </span>
                                        <span className="subscription-row__total">
                                            Total:{" "}
                                            {formatMoney(
                                                subscription.total_amount,
                                                subscription.currency_code
                                            )}
                                        </span>
                                    </div>

                                    <div className="subscription-row__actions">
                                        <s-button
                                            icon="view"
                                            accessibilityLabel={`View subscription ${subscription.reference}`}
                                            onClick={() =>
                                                goToSubscriptionDetail(navigate, subscription.id)
                                            }
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </s-stack>
            </s-page>
        </div>
    );
}
