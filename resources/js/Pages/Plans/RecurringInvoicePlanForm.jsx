import PlanEditor from "@/Components/Plans/Create/PlanEditor";
import ProductSelector from "@/Components/Plans/Create/ProductSelector";
import PlanSummary from "@/Components/Plans/Create/PlanSummary";
import PlanFormLoader from "@/Components/Plans/PlanFormLoader";
import RecurringIntervalsSection, {
    RecurringEmailSection,
    RecurringDiscountSection,
} from "@/Components/Plans/RecurringInvoice/RecurringIntervalsSection";
import { useRecurringInvoicePlanForm } from "@/hooks/plans/useRecurringInvoicePlanForm";
import { formatPlanStatus } from "@/utils/planHelpers";
import "@/styles/plans.css";

export default function RecurringInvoicePlanForm({ planId = null, onBack, onSaved }) {
    const {
        isEdit,
        planName,
        setPlanName,
        widget,
        setWidget,
        planStatus,
        products,
        removeProduct,
        removeProductGroup,
        handleSelectProducts,
        intervalUnit,
        setIntervalUnit,
        intervalOptions,
        addInterval,
        updateInterval,
        removeInterval,
        subscriptionEmailHour,
        setSubscriptionEmailHour,
        giveDiscount,
        setGiveDiscount,
        discountAmount,
        setDiscountAmount,
        discountDescription,
        setDiscountDescription,
        loading,
        initialLoading,
        summary,
        handleSaveDraft,
        handlePublish,
        handleSaveChanges,
    } = useRecurringInvoicePlanForm({
        planId,
        onSuccess: () => {
            onSaved?.();
            onBack();
        },
    });

    const pageHeading = isEdit
        ? `Edit: ${planName || "Recurring invoice"}`
        : planName || "New recurring invoice";

    return (
        <div className="plans-page">
            <s-page heading={pageHeading}>
                <s-button slot="secondary-action" onClick={onBack}>
                    Back to Plans
                </s-button>

                {isEdit ? (
                    <s-button
                        slot="primary-action"
                        variant="primary"
                        loading={loading}
                        onClick={handleSaveChanges}
                    >
                        Save changes
                    </s-button>
                ) : (
                    <s-button
                        slot="primary-action"
                        variant="primary"
                        loading={loading}
                        onClick={handlePublish}
                    >
                        Publish
                    </s-button>
                )}

                <s-stack direction="block" gap="base">
                    <s-banner tone="info">
                        <s-paragraph>
                            Recurring invoice plans are saved locally and are not synced to
                            Shopify selling plans.
                        </s-paragraph>
                    </s-banner>

                    <div className="plans-page-header">
                        <span className="plans-page-header__badge plans-page-header__badge--edit">
                            Recurring invoice
                        </span>
                        {isEdit && (
                            <s-badge tone={planStatus === "active" ? "success" : "warning"}>
                                {formatPlanStatus(planStatus)}
                            </s-badge>
                        )}
                    </div>

                    {initialLoading ? (
                        <PlanFormLoader />
                    ) : (
                        <div className="plan-form-layout">
                            <div className="plan-form-main">
                                <div className="plan-section-card">
                                    <PlanEditor
                                        planName={planName}
                                        widget={widget}
                                        onPlanNameChange={setPlanName}
                                        onWidgetChange={setWidget}
                                    />
                                </div>

                                <div className="plan-section-card">
                                    <ProductSelector
                                        products={products}
                                        onSelectProducts={handleSelectProducts}
                                        onRemoveProduct={removeProduct}
                                        onRemoveProductGroup={removeProductGroup}
                                    />
                                </div>

                                <div className="plan-section-card">
                                    <div className="plan-section-card__header">
                                        <span className="plan-section-card__icon">🔄</span>
                                        <h3 className="plan-section-card__title">
                                            Subscription intervals
                                        </h3>
                                    </div>
                                    <RecurringIntervalsSection
                                        intervalUnit={intervalUnit}
                                        intervalOptions={intervalOptions}
                                        onIntervalUnitChange={setIntervalUnit}
                                        onIntervalChange={updateInterval}
                                        onAddInterval={addInterval}
                                        onRemoveInterval={removeInterval}
                                    />
                                    <RecurringEmailSection
                                        subscriptionEmailHour={subscriptionEmailHour}
                                        onChange={setSubscriptionEmailHour}
                                    />
                                </div>

                                <div className="plan-section-card">
                                    <RecurringDiscountSection
                                        giveDiscount={giveDiscount}
                                        discountAmount={discountAmount}
                                        discountDescription={discountDescription}
                                        onGiveDiscountChange={setGiveDiscount}
                                        onDiscountAmountChange={setDiscountAmount}
                                        onDiscountDescriptionChange={setDiscountDescription}
                                    />
                                </div>
                            </div>

                            <div className="plan-form-sidebar">
                                <PlanSummary
                                    summary={summary}
                                    deliveryOptions={intervalOptions.map((opt) => ({
                                        id: opt.id,
                                        name: `${opt.frequency} ${intervalUnit}`,
                                        deliveryFrequency: opt.frequency,
                                        deliveryInterval: intervalUnit,
                                        giveDiscount,
                                        discountAmount,
                                        discountType: "Percentage off",
                                        changeDiscountAfterOrders: false,
                                    }))}
                                    loading={loading}
                                    isEdit={isEdit}
                                    isLocalOnly
                                    onBack={onBack}
                                    onSaveDraft={handleSaveDraft}
                                    onPublish={handlePublish}
                                    onSaveChanges={handleSaveChanges}
                                />
                            </div>
                        </div>
                    )}
                </s-stack>
            </s-page>
        </div>
    );
}
