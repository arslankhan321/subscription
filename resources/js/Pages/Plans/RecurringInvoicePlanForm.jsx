import PlanEditor from "@/Components/Plans/Create/PlanEditor";
import ProductSelector from "@/Components/Plans/Create/ProductSelector";
import PlanSummary from "@/Components/Plans/Create/PlanSummary";
import PlanFormLoader from "@/Components/Plans/PlanFormLoader";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
import PlanValidationBanner from "@/Components/Plans/PlanValidationBanner";
import RecurringIntervalsSection, {
    RecurringEmailSection,
    RecurringDiscountSection,
} from "@/Components/Plans/RecurringInvoice/RecurringIntervalsSection";
import { useRecurringInvoicePlanForm } from "@/hooks/plans/useRecurringInvoicePlanForm";
import { useShopifySaveBar } from "@/hooks/useShopifySaveBar";
import { formatPlanStatus } from "@/utils/planHelpers";
import "@/styles/plans.css";

export default function RecurringInvoicePlanForm({ planId = null, onBack, onSaved }) {
    const {
        isEdit,
        isDirty,
        saveBarId,
        validationErrors,
        fieldErrors,
        intervalOptionErrors,
        clearFieldError,
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
        handleSaveFromBar,
        handleDiscard,
    } = useRecurringInvoicePlanForm({
        planId,
        onSuccess: () => {
            onSaved?.();
            onBack();
        },
    });

    const { confirmLeave } = useShopifySaveBar({
        id: saveBarId,
        isDirty,
        enabled: !initialLoading,
    });

    const handleBack = async () => {
        await confirmLeave();
        onBack?.();
    };

    const pageHeading = isEdit
        ? `Edit: ${planName || "Recurring invoice"}`
        : planName || "New recurring invoice";

    return (
        <div className="plans-page">
            <s-page heading={pageHeading}>
                <PlanSaveBar
                    id={saveBarId}
                    onSave={handleSaveFromBar}
                    onDiscard={handleDiscard}
                    saving={loading}
                    saveLabel={isEdit ? "Save" : "Save draft"}
                />

                <s-button slot="secondary-action" onClick={handleBack}>
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
                                <PlanValidationBanner errors={validationErrors} />

                                <div className="plan-section-card">
                                    <PlanEditor
                                        planName={planName}
                                        widget={widget}
                                        fieldErrors={fieldErrors}
                                        onPlanNameChange={(value) => {
                                            setPlanName(value);
                                            clearFieldError("planName");
                                        }}
                                        onWidgetChange={(value) => {
                                            setWidget(value);
                                            clearFieldError("widget");
                                        }}
                                    />
                                </div>

                                <div className="plan-section-card">
                                    <ProductSelector
                                        products={products}
                                        fieldErrors={fieldErrors}
                                        onSelectProducts={async () => {
                                            await handleSelectProducts();
                                            clearFieldError("products");
                                        }}
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
                                        intervalOptionErrors={intervalOptionErrors}
                                        sectionError={fieldErrors.intervalOptions}
                                        onIntervalUnitChange={setIntervalUnit}
                                        onIntervalChange={(id, frequency) => {
                                            updateInterval(id, frequency);
                                            clearFieldError("intervalOptions");
                                        }}
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
                                        fieldErrors={fieldErrors}
                                        onGiveDiscountChange={(value) => {
                                            setGiveDiscount(value);
                                            clearFieldError("discountAmount");
                                            clearFieldError("discountDescription");
                                        }}
                                        onDiscountAmountChange={(value) => {
                                            setDiscountAmount(value);
                                            clearFieldError("discountAmount");
                                        }}
                                        onDiscountDescriptionChange={(value) => {
                                            setDiscountDescription(value);
                                            clearFieldError("discountDescription");
                                        }}
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
                                    onBack={handleBack}
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
