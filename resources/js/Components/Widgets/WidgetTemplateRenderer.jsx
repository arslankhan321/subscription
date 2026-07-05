import { useMemo, useState } from "react";
import { PREVIEW_FREQUENCIES } from "@/constants/widgetConstants";
import { buildWidgetCssVars, formatPrice, mergeWidgetSettings } from "@/utils/widgetStyleHelpers";

function PurchaseHeader({ title }) {
    const safeTitle = String(title ?? "Purchase options").toUpperCase();

    return (
        <div className="po-header">
            <span className="po-header__line" />
            <span className="po-header__title">{safeTitle}</span>
            <span className="po-header__line" />
        </div>
    );
}

function PriceBlock({ settings, price, compareAt }) {
    if (!settings.display.showPrices) return null;

    const showCompare = compareAt && compareAt !== price;

    return (
        <div className="po-price">
            {showCompare && (
                <span className="po-price__compare">
                    {formatPrice(settings.display.currencySymbol, compareAt)}
                </span>
            )}
            <strong>{formatPrice(settings.display.currencySymbol, price)}</strong>
            <small>{settings.labels.perMonth}</small>
        </div>
    );
}

function SaveBadge({ settings, percent }) {
    if (!settings.display.showDiscount || !percent) return null;

    return (
        <span className="po-save-badge">
            <span className="po-save-badge__spark">✦</span>
            {settings.labels.saveBadge} {percent}
        </span>
    );
}

function BillingBadge({ settings, billingType }) {
    if (!settings.display.showBadges || !billingType) return null;

    const isPrepaid = billingType === "Prepaid";

    return (
        <span className={`po-billing-badge${isPrepaid ? " po-billing-badge--prepaid" : ""}`}>
            {billingType}
        </span>
    );
}

function FrequencyRow({ freq, selected, onSelect, settings, interactive }) {
    return (
        <label
            className={`po-frequency${selected ? " po-frequency--selected" : ""}`}
            onClick={() => interactive && onSelect?.(freq.id)}
        >
            <span className="po-radio">
                <span className={`po-radio__dot${selected ? " po-radio__dot--on" : ""}`} />
            </span>
            <span className="po-frequency__text">
                <span className="po-frequency__label-row">
                    <span>{freq.label}</span>
                    <SaveBadge settings={settings} percent={freq.savePercent} />
                </span>
                {freq.sublabel && <small>{freq.sublabel}</small>}
                <BillingBadge settings={settings} billingType={freq.billingType} />
            </span>
            <PriceBlock settings={settings} price={freq.price} compareAt={freq.compareAt} />
        </label>
    );
}

function BenefitsList({ settings }) {
    if (!settings.features.showBenefits) return null;

    return (
        <ul className="po-benefits">
            {settings.features.benefits.map((benefit) => (
                <li key={benefit}>
                    <span className="po-benefits__check">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                                d="M2.5 6l2.5 2.5 4.5-5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                    {benefit}
                </li>
            ))}
        </ul>
    );
}

function SubscriptionDetails({ settings }) {
    if (!settings.features.showSubscriptionDetails) return null;

    return (
        <button type="button" className="po-details-link">
            <span className="po-details-link__icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7 6.2V9.5M7 4.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
            </span>
            {settings.labels.subscriptionDetails}
        </button>
    );
}

function CardBadge({ settings }) {
    if (!settings.features.showCardBadge || !settings.features.cardBadgeText) return null;

    return (
        <span className="po-card-badge">
            <span className="po-card-badge__star">★</span>
            {settings.features.cardBadgeText}
        </span>
    );
}

function RewardsBanner({ settings }) {
    if (!settings.features.showRewardsBanner) return null;

    return (
        <div className="po-rewards-banner">
            <div className="po-rewards-banner__icon">🎁</div>
            <div>
                <strong>{settings.labels.rewardsTitle}</strong>
                <p>{settings.features.rewardsBannerText}</p>
            </div>
        </div>
    );
}

function SubscribeTitle({ settings, savePercent = "15%" }) {
    return (
        <div className="po-subscribe-title">
            <span className="po-subscribe-title__icon">↻</span>
            <span>{settings.labels.subscribeAndSave}</span>
            <SaveBadge settings={settings} percent={savePercent} />
        </div>
    );
}

function PurchaseClassicTemplate({ settings, frequencies, selectedFreq, onSelectFreq, interactive }) {
    const merged = mergeWidgetSettings(settings);
    const oneTimeSelected = selectedFreq === "one-time";
    const bestSave = frequencies.find((f) => f.savePercent)?.savePercent ?? "15%";

    return (
        <div className="po-widget po-widget--classic">
            <PurchaseHeader title={merged.labels.purchaseOptionsTitle} />

            <label
                className={`po-row po-row--simple${oneTimeSelected ? " po-row--selected" : ""}`}
                onClick={() => interactive && onSelectFreq?.("one-time")}
            >
                <span className="po-radio">
                    <span className={`po-radio__dot${oneTimeSelected ? " po-radio__dot--on" : ""}`} />
                </span>
                <span className="po-row__label">{merged.labels.oneTimePurchase}</span>
                <PriceBlock settings={merged} price="100.00" />
            </label>

            <div
                className={`po-subscribe-box po-subscribe-box--featured${!oneTimeSelected ? " po-subscribe-box--active" : ""}`}
            >
                <SubscribeTitle settings={merged} savePercent={bestSave} />
                {frequencies.map((freq) => (
                    <FrequencyRow
                        key={freq.id}
                        freq={freq}
                        selected={selectedFreq === freq.id}
                        onSelect={onSelectFreq}
                        settings={merged}
                        interactive={interactive}
                    />
                ))}
            </div>

            <SubscriptionDetails settings={merged} />
            <RewardsBanner settings={merged} />
        </div>
    );
}

function TwoCardsCompactTemplate({ settings, frequencies, selectedFreq, onSelectFreq, interactive }) {
    const merged = mergeWidgetSettings(settings);
    const oneTimeSelected = selectedFreq === "one-time";
    const selectedFrequency = frequencies.find((f) => f.id === selectedFreq) ?? frequencies[0];

    return (
        <div className="po-widget po-widget--two-cards">
            <PurchaseHeader title={merged.labels.purchaseOptionsTitle} />

            <div
                className={`po-card po-card--simple${oneTimeSelected ? " po-card--selected" : ""}`}
                onClick={() => interactive && onSelectFreq?.("one-time")}
                role="button"
                tabIndex={0}
            >
                <span className="po-radio">
                    <span className={`po-radio__dot${oneTimeSelected ? " po-radio__dot--on" : ""}`} />
                </span>
                <span className="po-row__label">{merged.labels.oneTimePurchase}</span>
                <PriceBlock settings={merged} price="100.00" />
            </div>

            <div
                className={`po-card po-card--subscribe po-card--featured${!oneTimeSelected ? " po-card--selected" : ""}`}
                onClick={() => interactive && onSelectFreq?.(selectedFrequency.id)}
                role="button"
                tabIndex={0}
            >
                <CardBadge settings={merged} />
                <SubscribeTitle settings={merged} savePercent={selectedFrequency.savePercent} />
                <BenefitsList settings={merged} />
                <div className="po-dropdown-preview">
                    <span>{selectedFrequency.label}</span>
                    <span className="po-dropdown-preview__caret">▾</span>
                </div>
                <PriceBlock
                    settings={merged}
                    price={selectedFrequency.price}
                    compareAt={selectedFrequency.compareAt}
                />
            </div>

            <SubscriptionDetails settings={merged} />
            <RewardsBanner settings={merged} />
        </div>
    );
}

function ClassicDropdownTemplate({ settings, frequencies, selectedFreq, onSelectFreq, interactive }) {
    const merged = mergeWidgetSettings(settings);
    const [dropdownValue, setDropdownValue] = useState(frequencies[0]?.id ?? "");
    const oneTimeSelected = selectedFreq === "one-time";
    const activeFreq = frequencies.find((f) => f.id === dropdownValue) ?? frequencies[0];

    return (
        <div className="po-widget po-widget--dropdown">
            <PurchaseHeader title={merged.labels.purchaseOptionsTitle} />

            <label
                className={`po-row po-row--simple${oneTimeSelected ? " po-row--selected" : ""}`}
                onClick={() => interactive && onSelectFreq?.("one-time")}
            >
                <span className="po-radio">
                    <span className={`po-radio__dot${oneTimeSelected ? " po-radio__dot--on" : ""}`} />
                </span>
                <span className="po-row__label">{merged.labels.oneTimePurchase}</span>
                <PriceBlock settings={merged} price="100.00" />
            </label>

            <div
                className={`po-subscribe-box po-subscribe-box--featured${!oneTimeSelected ? " po-subscribe-box--active" : ""}`}
            >
                <label className="po-subscribe-box__head">
                    <span className="po-radio">
                        <span className={`po-radio__dot${!oneTimeSelected ? " po-radio__dot--on" : ""}`} />
                    </span>
                    <SubscribeTitle settings={merged} savePercent={activeFreq?.savePercent} />
                </label>

                {!oneTimeSelected && (
                    <div className="po-dropdown-field">
                        <label className="po-dropdown-field__label">
                            {merged.labels.selectFrequency}
                        </label>
                        <select
                            className="po-dropdown-field__select"
                            value={dropdownValue}
                            onChange={(e) => {
                                setDropdownValue(e.target.value);
                                onSelectFreq?.(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {frequencies.map((freq) => (
                                <option key={freq.id} value={freq.id}>
                                    {freq.label} — Save {freq.savePercent}
                                </option>
                            ))}
                        </select>
                        {activeFreq?.sublabel && (
                            <small className="po-dropdown-field__hint">{activeFreq.sublabel}</small>
                        )}
                        <BillingBadge settings={merged} billingType={activeFreq?.billingType} />
                        <PriceBlock
                            settings={merged}
                            price={activeFreq?.price ?? "100.00"}
                            compareAt={activeFreq?.compareAt}
                        />
                    </div>
                )}
            </div>

            <SubscriptionDetails settings={merged} />
            <RewardsBanner settings={merged} />
        </div>
    );
}

function SplitBenefitsTemplate({ settings, frequencies, selectedFreq, onSelectFreq, interactive }) {
    const merged = mergeWidgetSettings(settings);
    const oneTimeSelected = selectedFreq === "one-time";
    const selectedFrequency = frequencies.find((f) => f.id === selectedFreq) ?? frequencies[1];

    return (
        <div className="po-widget po-widget--split">
            <PurchaseHeader title={merged.labels.purchaseOptionsTitle} />

            <div className="po-split-grid">
                <div
                    className={`po-split-card po-split-card--subscribe po-split-card--featured${!oneTimeSelected ? " po-split-card--active" : ""}`}
                    onClick={() => interactive && onSelectFreq?.(selectedFrequency.id)}
                    role="button"
                    tabIndex={0}
                >
                    <CardBadge settings={merged} />
                    <SubscribeTitle settings={merged} savePercent={selectedFrequency.savePercent} />
                    <PriceBlock
                        settings={merged}
                        price={selectedFrequency.price}
                        compareAt={selectedFrequency.compareAt}
                    />
                    <div className="po-dropdown-preview po-dropdown-preview--block">
                        <span>{merged.labels.selectFrequency}</span>
                        <strong>{selectedFrequency.label}</strong>
                    </div>
                    <div className="po-split-benefits">
                        <div className="po-split-benefit">
                            <span className="po-split-benefit__icon po-split-benefit__icon--cancel">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </span>
                            <small>Cancel quickly anytime</small>
                        </div>
                        <div className="po-split-benefit">
                            <span className="po-split-benefit__icon po-split-benefit__icon--swap">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 4h7M7 2l2 2-2 2M10 8H3M5 10L3 8l2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <small>Swap products easily</small>
                        </div>
                    </div>
                </div>

                <div
                    className={`po-split-card po-split-card--onetime${oneTimeSelected ? " po-split-card--active" : ""}`}
                    onClick={() => interactive && onSelectFreq?.("one-time")}
                    role="button"
                    tabIndex={0}
                >
                    <div className="po-split-card__title">{merged.labels.oneTimePurchase}</div>
                    <PriceBlock settings={merged} price="100.00" />
                </div>
            </div>

            <SubscriptionDetails settings={merged} />
            <RewardsBanner settings={merged} />
        </div>
    );
}

const TEMPLATE_MAP = {
    purchase_classic: PurchaseClassicTemplate,
    two_cards_compact: TwoCardsCompactTemplate,
    classic_dropdown: ClassicDropdownTemplate,
    split_benefits: SplitBenefitsTemplate,
    classic: PurchaseClassicTemplate,
    modern: TwoCardsCompactTemplate,
    pill: ClassicDropdownTemplate,
    card: SplitBenefitsTemplate,
    minimal: PurchaseClassicTemplate,
};

export default function WidgetTemplateRenderer({
    template = "purchase_classic",
    settings,
    frequencies = PREVIEW_FREQUENCIES,
    selectedId,
    onSelect,
    interactive = true,
    compact = false,
}) {
    const [internalSelected, setInternalSelected] = useState(selectedId ?? frequencies[1]?.id ?? "freq-2");
    const selectedFreq = selectedId ?? internalSelected;
    const handleSelect = onSelect ?? setInternalSelected;

    const style = useMemo(() => buildWidgetCssVars(settings), [settings]);
    const Component = TEMPLATE_MAP[template] || PurchaseClassicTemplate;

    return (
        <div
            className={`po-root${compact ? " po-root--compact" : ""} po-root--${template}`}
            style={style}
        >
            <Component
                settings={settings}
                frequencies={frequencies}
                selectedFreq={selectedFreq}
                onSelectFreq={handleSelect}
                interactive={interactive}
            />
        </div>
    );
}
