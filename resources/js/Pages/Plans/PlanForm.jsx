import PlanInfoBanner from "@/Components/Plans/Create/PlanInfoBanner";
import PlanEditor from "@/Components/Plans/Create/PlanEditor";
import ProductSelector from "@/Components/Plans/Create/ProductSelector";
import DeliveryOptionsSection from "@/Components/Plans/Create/DeliveryOptionsSection";
import PlanSummary from "@/Components/Plans/Create/PlanSummary";
import PlanFormLoader from "@/Components/Plans/PlanFormLoader";
import PlanSaveBar from "@/Components/Plans/PlanSaveBar";
import PlanValidationBanner from "@/Components/Plans/PlanValidationBanner";
import { usePlanForm } from "@/hooks/plans/usePlanForm";
import { useShopifySaveBar } from "@/hooks/useShopifySaveBar";
import { formatPlanStatus } from "@/utils/planHelpers";
import "@/styles/plans.css";

export default function PlanForm({ planId = null, onBack, onSaved }) {
    const {
        isEdit,
        isDirty,
        saveBarId,
        validationErrors,
        fieldErrors,
        deliveryOptionErrors,
        clearFieldError,
        planName,
        setPlanName,
        planStatus,
        products,
        removeProduct,
        removeProductGroup,
        handleSelectProducts,
        deliveryOptions,
        updateOption,
        toggleCollapsed,
        addOption,
        duplicateOption,
        removeOption,
        loading,
        initialLoading,
        summary,
        handleSaveDraft,
        handlePublish,
        handleSaveChanges,
        handleSaveFromBar,
        handleDiscard,
    } = usePlanForm({
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

    const pageHeading = isEdit ? `Edit: ${planName || "Plan"}` : planName || "New plan";

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
                    <div className="plans-page-header">
                        <span className={`plans-page-header__badge ${isEdit ? "plans-page-header__badge--edit" : ""}`}>
                            {isEdit ? "Editing" : "New plan"}
                        </span>
                        {isEdit && (
                            <s-badge tone={planStatus === "active" ? "success" : planStatus === "draft" ? "warning" : "critical"}>
                                {formatPlanStatus(planStatus)}
                            </s-badge>
                        )}
                    </div>

                    <div className="plans-form-banner">
                        <PlanInfoBanner />
                    </div>

                    {initialLoading ? (
                        <PlanFormLoader />
                    ) : (
                        <div className="plan-form-layout">
                            <div className="plan-form-main">
                                <PlanValidationBanner errors={validationErrors} />

                                <div className="plan-section-card">
                                    <div className="plan-section-card__header">
                                        <span className="plan-section-card__icon">✏️</span>
                                        <h3 className="plan-section-card__title">Plan details</h3>
                                    </div>
                                    <PlanEditor
                                        planName={planName}
                                        fieldErrors={fieldErrors}
                                        onPlanNameChange={(value) => {
                                            setPlanName(value);
                                            clearFieldError("planName");
                                        }}
                                    />
                                </div>

                                <div className="plan-section-card">
                                    <div className="plan-section-card__header">
                                        <span className="plan-section-card__icon">🛍️</span>
                                        <h3 className="plan-section-card__title">Products</h3>
                                    </div>
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
                                        <h3 className="plan-section-card__title">Delivery options</h3>
                                    </div>
                                    <DeliveryOptionsSection
                                        deliveryOptions={deliveryOptions}
                                        deliveryOptionErrors={deliveryOptionErrors}
                                        sectionError={fieldErrors.deliveryOptions}
                                        onUpdate={(id, patch) => {
                                            updateOption(id, patch);
                                            clearFieldError("deliveryOptions");
                                        }}
                                        onToggleCollapsed={toggleCollapsed}
                                        onDuplicate={duplicateOption}
                                        onRemove={removeOption}
                                        onAdd={addOption}
                                    />
                                </div>
                            </div>

                            <div className="plan-form-sidebar">
                                <PlanSummary
                                    summary={summary}
                                    deliveryOptions={deliveryOptions}
                                    loading={loading}
                                    isEdit={isEdit}
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
