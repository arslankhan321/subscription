import { useCallback, useEffect, useRef, useState } from "react";
import { ModalListSkeleton } from "@/Components/Skeletons";
import { searchSubscriptionCustomers } from "@/Services/subscriptionService";
import { getApiErrorMessage, showToast } from "@/utils/shopifyToast";
import "@/styles/skeleton.css";

const MODAL_ID = "select-subscription-customer-modal";

export function useSelectCustomerModal({ onSelect }) {
    const modalRef = useRef(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const open = useCallback(() => {
        setQuery("");
        setResults([]);
        setSearched(false);
        modalRef.current?.showOverlay?.();
    }, []);

    const close = useCallback(() => {
        modalRef.current?.hideOverlay?.();
    }, []);

    const runSearch = useCallback(async (value) => {
        const term = String(value || "").trim();

        if (term.length < 2) {
            setResults([]);
            setSearched(false);
            return;
        }

        setLoading(true);
        setSearched(true);

        try {
            const response = await searchSubscriptionCustomers(term);
            setResults(response.data?.data || []);
        } catch (error) {
            setResults([]);
            showToast(getApiErrorMessage(error, "Unable to search customers"), {
                isError: true,
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handle = setTimeout(() => {
            runSearch(query);
        }, 350);

        return () => clearTimeout(handle);
    }, [query, runSearch]);

    const modal = (
        <s-modal
            ref={modalRef}
            id={MODAL_ID}
            heading="Select customer"
            accessibilityLabel="Select customer"
            size="large"
        >
            <s-stack direction="block" gap="base">
                <s-search-field
                    label="Search customers"
                    labelAccessibilityVisibility="exclusive"
                    placeholder="Search by name, email, or phone"
                    value={query}
                    onInput={(event) => setQuery(event.target.value)}
                />

                {loading ? (
                    <ModalListSkeleton rows={4} />
                ) : !searched ? (
                    <s-text tone="subdued">
                        Type at least 2 characters to search Shopify customers.
                    </s-text>
                ) : results.length === 0 ? (
                    <s-banner tone="warning">No customers found for that search.</s-banner>
                ) : (
                    <div className="subscription-customer-results">
                        {results.map((customer) => (
                            <div key={customer.id} className="subscription-customer-result">
                                <div className="subscription-customer-result__main">
                                    <div
                                        className="subscription-customer-result__avatar"
                                        aria-hidden="true"
                                    >
                                        👤
                                    </div>
                                    <div>
                                        <strong>
                                            {customer.display_name ||
                                                `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                                                "Customer"}
                                        </strong>
                                        <div className="subscription-customer-result__meta">
                                            {customer.email || "No email"}
                                        </div>
                                        {customer.location && (
                                            <div className="subscription-customer-result__meta">
                                                {customer.location}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <s-button
                                    variant="primary"
                                    onClick={() => {
                                        onSelect?.(customer);
                                        close();
                                    }}
                                >
                                    Select
                                </s-button>
                            </div>
                        ))}
                    </div>
                )}
            </s-stack>

            <s-button slot="secondary-actions" onClick={close}>
                Cancel
            </s-button>
        </s-modal>
    );

    return { open, modal };
}
