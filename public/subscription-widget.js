/**
 * Subscribify storefront widget — Shadow DOM loader.
 * Mount: #subscription-widget with data-widget-name + data-app-url
 * Plans: #subscription-widget-data JSON (from theme extension block)
 */
(function () {
    "use strict";

    if (window.__SUBSCRIBIFY_WIDGET__) {
        return;
    }
    window.__SUBSCRIBIFY_WIDGET__ = true;

    const MOUNT_ID = "subscription-widget";
    const DATA_ID = "subscription-widget-data";
    const LOG = "[Subscribify]";

    function log(step, message, data) {
        if (data !== undefined) {
            console.log(`${LOG} [${step}] ${message}`, data);
            return;
        }
        console.log(`${LOG} [${step}] ${message}`);
    }

    function warn(step, message, data) {
        if (data !== undefined) {
            console.warn(`${LOG} [${step}] ${message}`, data);
            return;
        }
        console.warn(`${LOG} [${step}] ${message}`);
    }

    function error(step, message, data) {
        if (data !== undefined) {
            console.error(`${LOG} [${step}] ${message}`, data);
            return;
        }
        console.error(`${LOG} [${step}] ${message}`);
    }

    log("BOOT", "subscription-widget.js loaded", {
        readyState: document.readyState,
        url: window.location.href,
    });

    function init() {
        log("INIT", "Starting widget init");

        const mount = document.getElementById(MOUNT_ID);
        if (!mount) {
            warn("INIT", `Mount element #${MOUNT_ID} not found — theme block/embed likely not enabled or product has no selling plans in Liquid`);
            return;
        }

        if (mount.shadowRoot) {
            log("INIT", "Already initialized — skipping");
            return;
        }

        log("INIT", "Mount element found", {
            widgetName: mount.dataset.widgetName || "(auto-active)",
            appUrl: mount.dataset.appUrl || "(from script)",
        });

        const widgetName = (mount.dataset.widgetName || "").trim();
        const appBase = normalizeAppBase(mount.dataset.appUrl || getScriptOrigin());
        if (!appBase) {
            error("CONFIG", "Missing app URL — set App URL in theme block settings");
            return;
        }

        log("CONFIG", "Resolved app base", { appBase, widgetName: widgetName || "(auto-active)" });

        const productData = parseProductData();
        if (!productData?.productId) {
            error("PRODUCT", "No product data — theme block did not render #subscription-widget-data");
            return;
        }

        const shopDomain = (mount.dataset.shop || productData.shop || "").trim();

        log("PRODUCT", "Product data parsed", {
            productId: productData.productId,
            shop: shopDomain || "(missing)",
            selectedVariantId: productData.selectedVariantId,
            variantCount: Object.keys(productData.variants || {}).length,
            allocationCount:
                productData.variants?.[String(productData.selectedVariantId)]?.allocations?.length ?? 0,
        });

        placeWidgetNearForm(mount);

        const shadow = mount.attachShadow({ mode: "open" });
        const root = document.createElement("div");
        root.className = "sw-shadow-root";
        shadow.appendChild(root);
        root.innerHTML = `<div class="po-root"><div class="po-widget" style="padding:1rem;color:#6b7280;">Loading subscription options…</div></div>`;

        const state = {
            mode: "auto_charge",
            selectedId: "one-time",
            selectedOptionId: null,
            variantId: String(productData.selectedVariantId),
            productData,
            invoicePlan: null,
            shop: shopDomain,
        };

        const cssUrl = `${appBase}/storefront/widget.css`;

        log("FETCH", "Loading widget config + CSS", {
            widgetUrl: widgetName
                ? `${appBase}/storefront/widgets/${encodeURIComponent(widgetName)}`
                : `${appBase}/storefront/widgets/active`,
            cssUrl,
        });

        loadWidgetConfig(appBase, widgetName)
            .then(async (widgetPayload) => {
                log("FETCH", "Widget config response", widgetPayload);

                if (!widgetPayload?.success || !widgetPayload.data) {
                    error("FETCH", "Widget config not found — activate a widget in Subscribify app", widgetPayload);
                    mount.remove();
                    return;
                }

                let cssText = "";
                try {
                    cssText = await fetchText(cssUrl);
                    log("FETCH", "CSS loaded", { bytes: cssText?.length ?? 0, url: cssUrl });
                } catch (cssError) {
                    warn("FETCH", "CSS failed — widget will render with minimal styles", cssError);
                }

                injectStyles(shadow, cssText);

                const widget = widgetPayload.data;
                const settings = widget.settings || {};
                applyCssVars(root, settings);

                const planUrl =
                    `${appBase}/storefront/products/${encodeURIComponent(productData.productId)}/plan` +
                    (shopDomain ? `?shop=${encodeURIComponent(shopDomain)}` : "");

                let planPayload = null;
                try {
                    const planRes = await fetchJson(planUrl);
                    planPayload = planRes?.success ? planRes.data : null;
                    log("PLAN", "Storefront plan lookup", planPayload);
                } catch (planError) {
                    warn("PLAN", "Plan lookup failed — falling back to selling plans", planError);
                }

                // Prefer auto_charge when selling-plan allocations exist (even if an
                // invoice plan is also attached — matches storefrontPlanForProduct).
                if (productHasSellingPlanAllocations(productData)) {
                    log("RENDER", "Rendering auto_charge widget", {
                        name: widget.name,
                        template: widget.template,
                        planType: planPayload?.plan_type ?? null,
                    });

                    render(root, widget.template, settings, state);
                    bindSellingPlanSync(state);
                    watchVariantChanges(mount, root, widget.template, settings, state);

                    log("DONE", "Widget ready");
                    return;
                }

                if (
                    planPayload?.plan_type === "recurring_invoice" &&
                    Array.isArray(planPayload.options) &&
                    planPayload.options.length > 0
                ) {
                    state.mode = "recurring_invoice";
                    state.invoicePlan = planPayload;
                    state.selectedId = "subscribe";
                    state.selectedOptionId = String(planPayload.options[0].id);
                    state.variantId = String(
                        getCurrentVariantId() || productData.selectedVariantId || state.variantId
                    );

                    log("RENDER", "Rendering separate recurring-invoice dropdown", {
                        planId: planPayload.plan_id,
                        optionCount: planPayload.options.length,
                        variantId: state.variantId,
                        variantIds: planPayload.variant_ids || [],
                    });

                    applyInvoiceVisibility(mount, root, settings, state);
                    watchVariantChangesInvoice(mount, root, settings, state);
                    log("DONE", "Recurring invoice dropdown ready");
                    return;
                }

                warn("PRODUCT", "No recurring_invoice plan and no selling plan allocations — hiding widget");
                mount.remove();
            })
            .catch((fetchError) => {
                error("FETCH", "Failed to load widget config", fetchError);
                mount.remove();
            });
    }

    async function loadWidgetConfig(appBase, widgetName) {
        if (widgetName) {
            const namedUrl = `${appBase}/storefront/widgets/${encodeURIComponent(widgetName)}`;
            log("FETCH", `Trying named widget: "${widgetName}"`, { url: namedUrl });
            const named = await fetchJson(namedUrl);
            if (named?.success && named.data) {
                log("FETCH", `Named widget loaded: "${widgetName}"`);
                return named;
            }
            warn("FETCH", `Widget "${widgetName}" not found, falling back to active widget`, named);
        } else {
            log("FETCH", "No widget name set, loading active widget");
        }

        const activeUrl = `${appBase}/storefront/widgets/active`;
        log("FETCH", "Trying active widget", { url: activeUrl });
        return fetchJson(activeUrl);
    }

    /** Absolute origin, or origin + proxy path (e.g. /apps/subscribify). */
    function normalizeAppBase(url) {
        if (!url) return "";
        try {
            const parsed = new URL(String(url).trim(), window.location.href);
            const path = parsed.pathname.replace(/\/$/, "");
            return path ? `${parsed.origin}${path}` : parsed.origin;
        } catch {
            return String(url).replace(/\/$/, "");
        }
    }

    function getScriptOrigin() {
        const script = document.currentScript || document.querySelector(`script[src*="subscription-widget.js"]`);
        if (!script?.src) return window.location.origin;
        try {
            return new URL(script.src).origin;
        } catch {
            return window.location.origin;
        }
    }

    function extractJsonText(raw) {
        let text = String(raw || "");
        // Shopify wraps {% render %} snippets with <!-- BEGIN ... --> comments
        text = text.replace(/<!--[\s\S]*?-->/g, "").trim();
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end === -1 || end <= start) {
            return text;
        }
        return text.slice(start, end + 1);
    }

    function parseProductData() {
        const node = document.getElementById(DATA_ID);
        if (!node) {
            warn("PRODUCT", `#${DATA_ID} JSON script not found — Liquid block did not render product plans`);
            return null;
        }

        try {
            const jsonText = extractJsonText(node.textContent);
            const data = JSON.parse(jsonText);
            const selectedKey = String(data.selectedVariantId);

            log("PRODUCT", "Raw product JSON parsed", {
                productId: data.productId,
                shop: data.shop,
                selectedVariantId: selectedKey,
                variants: Object.keys(data.variants || {}).map((id) => ({
                    id,
                    allocations: data.variants[id]?.allocations?.length ?? 0,
                })),
            });

            // Liquid already filtered by group ID; only drop other apps' tagged rows
            const appId = data.appId || "subscribify";
            Object.keys(data.variants || {}).forEach((key) => {
                const allocations = data.variants[key].allocations || [];
                data.variants[key].allocations = allocations.filter((allocation) => {
                    const rowAppId = allocation.appId;
                    if (rowAppId == null || rowAppId === "") return true;
                    return String(rowAppId) === String(appId);
                });
            });

            if (!data.variants?.[selectedKey] && Object.keys(data.variants || {}).length) {
                data.selectedVariantId = Object.keys(data.variants)[0];
            }

            return data;
        } catch (parseError) {
            error("PRODUCT", "Invalid product JSON in theme block", parseError);
            return null;
        }
    }

    function productHasSellingPlanAllocations(data) {
        return Object.keys(data?.variants || {}).some(
            (key) => (data.variants[key]?.allocations?.length ?? 0) > 0
        );
    }

    function fetchJson(url) {
        return fetch(url)
            .then((response) => {
                log("FETCH", `JSON ${response.status} ${response.statusText}`, { url });
                return response.json().then((body) => {
                    if (!response.ok) {
                        warn("FETCH", "JSON request failed", { url, status: response.status, body });
                    }
                    return body;
                });
            })
            .catch((fetchError) => {
                error("FETCH", "JSON network error", { url, error: fetchError });
                throw fetchError;
            });
    }

    function fetchText(url) {
        return fetch(url)
            .then((response) => {
                log("FETCH", `CSS ${response.status} ${response.statusText}`, { url });
                if (!response.ok) {
                    warn("FETCH", "CSS request failed", { url, status: response.status });
                }
                return response.text();
            })
            .catch((fetchError) => {
                error("FETCH", "CSS network error", { url, error: fetchError });
                throw fetchError;
            });
    }

    function injectStyles(shadow, cssText) {
        const style = document.createElement("style");
        style.textContent = cssText || "";
        shadow.appendChild(style);
    }

    function applyCssVars(root, settings) {
        const colors = settings.colors || {};
        const typography = settings.typography || {};
        const border = settings.border || {};

        const vars = {
            "--po-primary": colors.primary || "#7c3aed",
            "--po-secondary": colors.secondary || "#f5f3ff",
            "--po-text": colors.text || "#1f2937",
            "--po-border": colors.border || "#d1d5db",
            "--po-accent": colors.accent || "#8b5cf6",
            "--po-highlight": colors.highlight || "#111827",
            "--po-bg": colors.background || "#ffffff",
            "--po-price": colors.price || "#111827",
            "--po-font": typography.fontFamily || "inherit",
            "--po-title-size": `${typography.titleSize || 12}px`,
            "--po-body-size": `${typography.bodySize || 14}px`,
            "--po-font-weight": typography.fontWeight || "600",
            "--po-border-width": `${border.width || 2}px`,
            "--po-border-radius": `${border.radius || 12}px`,
        };

        Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    }

    function getVariantState(productData, variantId) {
        const variant = productData.variants?.[String(variantId)];
        if (!variant) return null;

        return {
            oneTimePrice: variant.price,
            compareAtPrice: variant.compareAtPrice,
            frequencies: variant.allocations.map((allocation, index) => mapAllocation(allocation, index)),
        };
    }

    function mapAllocation(allocation, index) {
        const price = centsToAmount(allocation.price);
        const compareAt = centsToAmount(allocation.compareAtPrice);
        const savePercent = calcSavePercent(allocation.price, allocation.compareAtPrice);

        return {
            id: String(allocation.sellingPlanId),
            sellingPlanId: String(allocation.sellingPlanId),
            label: allocation.name || allocation.groupName || `Plan ${index + 1}`,
            sublabel: buildSublabel(allocation.options),
            billingType: inferBillingType(allocation.options),
            price,
            compareAt,
            savePercent: savePercent ? `${savePercent}%` : null,
        };
    }

    function buildSublabel(options) {
        if (!Array.isArray(options) || !options.length) return null;
        const parts = options.map((opt) => opt.value || opt.name).filter(Boolean);
        return parts.length ? parts.join(" · ") : null;
    }

    function inferBillingType(options) {
        if (!Array.isArray(options)) return "Pay as you go";
        const text = options.map((o) => `${o.name || ""} ${o.value || ""}`).join(" ").toLowerCase();
        return text.includes("prepaid") || text.includes("pre-pay") ? "Prepaid" : "Pay as you go";
    }

    function centsToAmount(cents) {
        if (cents == null) return null;
        return (Number(cents) / 100).toFixed(2);
    }

    function calcSavePercent(price, compareAt) {
        if (!compareAt || compareAt <= price) return null;
        return Math.round(((compareAt - price) / compareAt) * 100);
    }

    function formatPrice(settings, amount) {
        const symbol = settings.display?.currencySymbol || "Rs.";
        return `${symbol}${amount ?? "0.00"}`;
    }

    function render(root, template, settings, state) {
        const variantState = getVariantState(state.productData, state.variantId);
        if (!variantState?.frequencies?.length) {
            warn("RENDER", "No frequencies to render for variant", { variantId: state.variantId });
            root.innerHTML = "";
            return;
        }

        log("RENDER", "Building template", {
            template,
            variantId: state.variantId,
            frequencyCount: variantState.frequencies.length,
            selectedId: state.selectedId,
        });

        const labels = settings.labels || {};
        const display = settings.display || {};
        const features = settings.features || {};
        const frequencies = variantState.frequencies;
        const oneTimeSelected = state.selectedId === "one-time";
        const defaultFreqId = frequencies[0]?.id;
        const activeFreqId = oneTimeSelected ? defaultFreqId : state.selectedId;
        const activeFreq = frequencies.find((f) => f.id === activeFreqId) || frequencies[0];
        const bestSave = frequencies.find((f) => f.savePercent)?.savePercent;

        if (!oneTimeSelected && !frequencies.some((f) => f.id === state.selectedId)) {
            state.selectedId = defaultFreqId;
        }

        const handlers = {
            selectOneTime: () => selectOption(state, "one-time"),
            selectFrequency: (id) => selectOption(state, id),
        };

        const html = buildTemplateHtml(template, {
            settings,
            labels,
            display,
            features,
            frequencies,
            variantState,
            oneTimeSelected,
            activeFreq,
            bestSave,
            formatPrice: (amount, compareAt) => priceBlockHtml(settings, amount, compareAt),
        });

        root.innerHTML = `<div class="po-root po-root--${template}">${html}</div>`;
        bindInteractions(root, handlers, template, settings, state);
        syncSellingPlanInput(state);
    }

    function buildTemplateHtml(template, ctx) {
        const builders = {
            purchase_classic: buildPurchaseClassic,
            classic: buildPurchaseClassic,
            two_cards_compact: buildTwoCards,
            modern: buildTwoCards,
            classic_dropdown: buildDropdown,
            pill: buildDropdown,
            split_benefits: buildSplitBenefits,
            card: buildSplitBenefits,
            minimal: buildPurchaseClassic,
        };

        const build = builders[template] || buildPurchaseClassic;
        return build(ctx);
    }

    function buildPurchaseClassic(ctx) {
        const { labels, frequencies, variantState, oneTimeSelected, bestSave, formatPrice } = ctx;

        const freqRows = frequencies
            .map(
                (freq) => `
            <label class="po-frequency${!oneTimeSelected && ctx.activeFreq?.id === freq.id ? " po-frequency--selected" : ""}" data-freq-id="${freq.id}">
                <span class="po-radio"><span class="po-radio__dot${!oneTimeSelected && ctx.activeFreq?.id === freq.id ? " po-radio__dot--on" : ""}"></span></span>
                <span class="po-frequency__text">
                    <span class="po-frequency__label-row">
                        <span>${escapeHtml(freq.label)}</span>
                        ${saveBadge(ctx, freq.savePercent)}
                    </span>
                    ${freq.sublabel ? `<small>${escapeHtml(freq.sublabel)}</small>` : ""}
                    ${billingBadge(ctx, freq.billingType)}
                </span>
                ${formatPrice(freq.price, freq.compareAt)}
            </label>`
            )
            .join("");

        return `
            <div class="po-widget po-widget--classic">
                ${headerHtml(labels.purchaseOptionsTitle)}
                <label class="po-row po-row--simple${oneTimeSelected ? " po-row--selected" : ""}" data-select="one-time">
                    <span class="po-radio"><span class="po-radio__dot${oneTimeSelected ? " po-radio__dot--on" : ""}"></span></span>
                    <span class="po-row__label">${escapeHtml(labels.oneTimePurchase || "One time purchase")}</span>
                    ${formatPrice(centsToAmount(variantState.oneTimePrice), centsToAmount(variantState.compareAtPrice))}
                </label>
                <div class="po-subscribe-box po-subscribe-box--featured${!oneTimeSelected ? " po-subscribe-box--active" : ""}">
                    ${subscribeTitle(labels, bestSave, ctx)}
                    ${freqRows}
                </div>
                ${footerHtml(ctx)}
            </div>`;
    }

    function buildTwoCards(ctx) {
        const { labels, frequencies, variantState, oneTimeSelected, activeFreq, formatPrice } = ctx;
        const benefits = benefitsHtml(ctx);

        return `
            <div class="po-widget po-widget--two-cards">
                ${headerHtml(labels.purchaseOptionsTitle)}
                <div class="po-card po-card--simple${oneTimeSelected ? " po-card--selected" : ""}" data-select="one-time" role="button" tabindex="0">
                    <span class="po-radio"><span class="po-radio__dot${oneTimeSelected ? " po-radio__dot--on" : ""}"></span></span>
                    <span class="po-row__label">${escapeHtml(labels.oneTimePurchase || "One time purchase")}</span>
                    ${formatPrice(centsToAmount(variantState.oneTimePrice), centsToAmount(variantState.compareAtPrice))}
                </div>
                <div class="po-card po-card--subscribe po-card--featured${!oneTimeSelected ? " po-card--selected" : ""}" data-select-freq="${activeFreq.id}" role="button" tabindex="0">
                    ${cardBadge(ctx)}
                    ${subscribeTitle(labels, activeFreq.savePercent, ctx)}
                    ${benefits}
                    <div class="po-dropdown-preview">
                        <span>${escapeHtml(activeFreq.label)}</span>
                        <span class="po-dropdown-preview__caret">▾</span>
                    </div>
                    ${formatPrice(activeFreq.price, activeFreq.compareAt)}
                </div>
                ${footerHtml(ctx)}
            </div>`;
    }

    function buildDropdown(ctx) {
        const { labels, frequencies, variantState, oneTimeSelected, activeFreq, formatPrice } = ctx;

        const options = frequencies
            .map(
                (freq) =>
                    `<option value="${freq.id}"${activeFreq.id === freq.id ? " selected" : ""}>${escapeHtml(freq.label)}${freq.savePercent ? ` — Save ${freq.savePercent}` : ""}</option>`
            )
            .join("");

        return `
            <div class="po-widget po-widget--dropdown">
                ${headerHtml(labels.purchaseOptionsTitle)}
                <label class="po-row po-row--simple${oneTimeSelected ? " po-row--selected" : ""}" data-select="one-time">
                    <span class="po-radio"><span class="po-radio__dot${oneTimeSelected ? " po-radio__dot--on" : ""}"></span></span>
                    <span class="po-row__label">${escapeHtml(labels.oneTimePurchase || "One time purchase")}</span>
                    ${formatPrice(centsToAmount(variantState.oneTimePrice), centsToAmount(variantState.compareAtPrice))}
                </label>
                <div class="po-subscribe-box po-subscribe-box--featured${!oneTimeSelected ? " po-subscribe-box--active" : ""}">
                    <label class="po-subscribe-box__head" data-select-freq="${activeFreq.id}">
                        <span class="po-radio"><span class="po-radio__dot${!oneTimeSelected ? " po-radio__dot--on" : ""}"></span></span>
                        ${subscribeTitle(labels, activeFreq.savePercent, ctx)}
                    </label>
                    ${!oneTimeSelected ? `
                    <div class="po-dropdown-field">
                        <label class="po-dropdown-field__label">${escapeHtml(labels.selectFrequency || "Select delivery frequency")}</label>
                        <select class="po-dropdown-field__select" data-freq-select>${options}</select>
                        ${activeFreq.sublabel ? `<small class="po-dropdown-field__hint">${escapeHtml(activeFreq.sublabel)}</small>` : ""}
                        ${billingBadge(ctx, activeFreq.billingType)}
                        ${formatPrice(activeFreq.price, activeFreq.compareAt)}
                    </div>` : ""}
                </div>
                ${footerHtml(ctx)}
            </div>`;
    }

    function buildSplitBenefits(ctx) {
        const { labels, variantState, oneTimeSelected, activeFreq, formatPrice } = ctx;

        return `
            <div class="po-widget po-widget--split">
                ${headerHtml(labels.purchaseOptionsTitle)}
                <div class="po-split-grid">
                    <div class="po-split-card po-split-card--subscribe po-split-card--featured${!oneTimeSelected ? " po-split-card--active" : ""}" data-select-freq="${activeFreq.id}" role="button" tabindex="0">
                        ${cardBadge(ctx)}
                        ${subscribeTitle(labels, activeFreq.savePercent, ctx)}
                        ${formatPrice(activeFreq.price, activeFreq.compareAt)}
                        <div class="po-dropdown-preview po-dropdown-preview--block">
                            <span>${escapeHtml(labels.selectFrequency || "Select delivery frequency")}</span>
                            <strong>${escapeHtml(activeFreq.label)}</strong>
                        </div>
                    </div>
                    <div class="po-split-card po-split-card--onetime${oneTimeSelected ? " po-split-card--active" : ""}" data-select="one-time" role="button" tabindex="0">
                        <div class="po-split-card__title">${escapeHtml(labels.oneTimePurchase || "One time purchase")}</div>
                        ${formatPrice(centsToAmount(variantState.oneTimePrice), centsToAmount(variantState.compareAtPrice))}
                    </div>
                </div>
                ${footerHtml(ctx)}
            </div>`;
    }

    function headerHtml(title) {
        const safe = escapeHtml(title || "Purchase options").toUpperCase();
        return `<div class="po-header"><span class="po-header__line"></span><span class="po-header__title">${safe}</span><span class="po-header__line"></span></div>`;
    }

    function subscribeTitle(labels, savePercent, ctx) {
        return `<div class="po-subscribe-title"><span class="po-subscribe-title__icon">↻</span><span>${escapeHtml(labels.subscribeAndSave || "Subscribe and save")}</span>${saveBadge(ctx, savePercent)}</div>`;
    }

    function saveBadge(ctx, percent) {
        if (!ctx.display.showDiscount || !percent) return "";
        const label = ctx.labels.saveBadge || "Save";
        return `<span class="po-save-badge"><span class="po-save-badge__spark">✦</span>${escapeHtml(label)} ${escapeHtml(percent)}</span>`;
    }

    function billingBadge(ctx, billingType) {
        if (!ctx.display.showBadges || !billingType) return "";
        const prepaid = billingType === "Prepaid";
        return `<span class="po-billing-badge${prepaid ? " po-billing-badge--prepaid" : ""}">${escapeHtml(billingType)}</span>`;
    }

    function priceBlockHtml(settings, price, compareAt) {
        if (settings.display?.showPrices === false) return "";
        const showCompare = compareAt && compareAt !== price;
        return `<div class="po-price">${showCompare ? `<span class="po-price__compare">${formatPrice(settings, compareAt)}</span>` : ""}<strong>${formatPrice(settings, price)}</strong><small>${escapeHtml(settings.labels?.perMonth || "per delivery")}</small></div>`;
    }

    function benefitsHtml(ctx) {
        if (!ctx.features.showBenefits) return "";
        const items = (ctx.features.benefits || []).map((b) => `<li><span class="po-benefits__check"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${escapeHtml(b)}</li>`).join("");
        return `<ul class="po-benefits">${items}</ul>`;
    }

    function cardBadge(ctx) {
        if (!ctx.features.showCardBadge || !ctx.features.cardBadgeText) return "";
        return `<span class="po-card-badge"><span class="po-card-badge__star">★</span>${escapeHtml(ctx.features.cardBadgeText)}</span>`;
    }

    function footerHtml(ctx) {
        let html = "";
        if (ctx.features.showSubscriptionDetails) {
            html += `<button type="button" class="po-details-link"><span class="po-details-link__icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M7 6.2V9.5M7 4.5h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></span>${escapeHtml(ctx.labels.subscriptionDetails || "Subscription details")}</button>`;
        }
        if (ctx.features.showRewardsBanner) {
            html += `<div class="po-rewards-banner"><div class="po-rewards-banner__icon">🎁</div><div><strong>${escapeHtml(ctx.labels.rewardsTitle || "Subscription rewards")}</strong><p>${escapeHtml(ctx.features.rewardsBannerText || "")}</p></div></div>`;
        }
        return html;
    }

    function bindInteractions(root, handlers, template, settings, state) {
        root.querySelectorAll("[data-select='one-time']").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                handlers.selectOneTime();
                rerender(root, template, settings, state);
            });
        });

        root.querySelectorAll("[data-freq-id]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                handlers.selectFrequency(el.dataset.freqId);
                rerender(root, template, settings, state);
            });
        });

        root.querySelectorAll("[data-select-freq]").forEach((el) => {
            el.addEventListener("click", (e) => {
                if (e.target.closest("[data-freq-select]")) return;
                e.preventDefault();
                handlers.selectFrequency(el.dataset.selectFreq);
                rerender(root, template, settings, state);
            });
        });

        const select = root.querySelector("[data-freq-select]");
        if (select) {
            select.addEventListener("change", () => {
                handlers.selectFrequency(select.value);
                rerender(root, template, settings, state);
            });
        }
    }

    function selectOption(state, id) {
        state.selectedId = id;
        log("SELECT", "Purchase option changed", { selectedId: id });
        syncSellingPlanInput(state);
    }

    function rerender(root, template, settings, state) {
        render(root, template, settings, state);
    }

    function isInstallmentsForm(form) {
        if (!form) return true;
        if (form.classList.contains("payment-terms")) return true;
        if (form.closest(".installments")) return true;
        if (form.closest("shopify-payment-terms")) return true;
        // Shop Pay terms form: hidden id only, no ATC controls
        const hasAtc =
            form.querySelector('[name="add"], [name="quantity"], button[type="submit"], .product-form-buttons') != null;
        const onlyPaymentTerms = form.querySelector("shopify-payment-terms, payment-terms") != null && !hasAtc;
        return onlyPaymentTerms;
    }

    function scoreProductForm(form) {
        let score = 0;
        if (isInstallmentsForm(form)) return -100;
        if (form.querySelector('[name="add"]')) score += 50;
        if (form.querySelector('[name="quantity"]')) score += 20;
        if (form.querySelector('[name="id"]')) score += 10;
        if (form.querySelector("button[type='submit'], button[name='add']")) score += 30;
        if (form.closest("product-form-component, .product-form, buy-buttons, .buy-buttons")) score += 25;
        if (form.id && /product/i.test(form.id)) score += 10;
        return score;
    }

    function getProductForm() {
        const candidates = Array.from(
            document.querySelectorAll('form[action*="/cart/add"], form.product-form, form[id*="product"]')
        );

        let best = null;
        let bestScore = -Infinity;
        candidates.forEach((form) => {
            const score = scoreProductForm(form);
            if (score > bestScore) {
                bestScore = score;
                best = form;
            }
        });

        if (best && bestScore >= 0) {
            log("FORM", "Using product form", {
                score: bestScore,
                action: best.getAttribute("action"),
                className: best.className,
                id: best.id || null,
            });
            return best;
        }

        warn("FORM", "No suitable ATC form found — falling back to first cart/add form", {
            candidates: candidates.length,
        });
        return candidates.find((f) => !isInstallmentsForm(f)) || candidates[0] || null;
    }

    function ensureMountVisible(mount) {
        mount.style.display = "block";
        mount.style.visibility = "visible";
        mount.style.width = "100%";
        mount.style.maxWidth = "100%";
        mount.style.margin = "1rem 0";
        mount.style.minHeight = "1px";
        mount.removeAttribute("hidden");
    }

    function placeWidgetNearForm(mount) {
        ensureMountVisible(mount);

        const form = getProductForm();
        if (!form?.parentNode) {
            warn("PLACE", "Product form not found — widget stays in default position");
            return;
        }

        // Prefer anchors near real buy buttons (Horizon / Dawn / common themes)
        const anchor =
            form.querySelector(".product-form-buttons, .product-form__buttons, buy-buttons, .buy-buttons") ||
            form.querySelector('[name="add"], button[name="add"], button[type="submit"]') ||
            form;

        const insertBeforeEl = anchor === form ? form : anchor;
        let parent = insertBeforeEl.parentNode;

        // Never nest inside Shop Pay installments / payment-terms wrapper
        if (parent?.closest?.(".installments, shopify-payment-terms") || parent?.classList?.contains("installments")) {
            const safeParent =
                form.closest("product-form-component, .product-form, .product__info-wrapper, .product__info, .product-information") ||
                form.parentNode;
            parent = safeParent;
            log("PLACE", "Avoided installments container, using safer parent", {
                parent: parent?.className || parent?.tagName,
            });
            try {
                parent.insertBefore(mount, form);
                ensureMountVisible(mount);
                log("PLACE", "Widget placed before main product form");
                return;
            } catch (e) {
                warn("PLACE", "Safe insert failed", e);
            }
        }

        const buyBox =
            form.closest("product-form-component") ||
            form.closest(".product__info-wrapper") ||
            form.closest(".product__info") ||
            form.closest(".product-information") ||
            form.closest(".product-single__meta") ||
            form.closest("[data-product-form]") ||
            parent;

        try {
            if (buyBox && insertBeforeEl && buyBox.contains(insertBeforeEl)) {
                buyBox.insertBefore(mount, insertBeforeEl);
                ensureMountVisible(mount);
                log("PLACE", "Widget moved before buy controls", {
                    container: buyBox.className || buyBox.tagName,
                    before: insertBeforeEl.className || insertBeforeEl.tagName || insertBeforeEl.name,
                });
                return;
            }

            if (form.parentNode && form.parentNode.contains(form)) {
                form.parentNode.insertBefore(mount, form);
                ensureMountVisible(mount);
                log("PLACE", "Widget inserted before product form");
            }
        } catch (placeError) {
            warn("PLACE", "Could not reposition widget — leaving in theme block position", placeError);
        }
    }

    /**
     * Separate UI for recurring_invoice — one closed dropdown + discount text.
     * Styles are inlined into Shadow DOM so cached widget.css cannot break the look.
     */
    function renderInvoice(root, settings, state) {
        const plan = state.invoicePlan;
        const options = plan.options || [];
        const activeOption =
            options.find((o) => String(o.id) === String(state.selectedOptionId)) || options[0];

        if (activeOption && String(state.selectedOptionId) !== String(activeOption.id)) {
            state.selectedOptionId = String(activeOption.id);
        }

        state.selectedId = "subscribe";
        state.invoiceDropdownOpen = Boolean(state.invoiceDropdownOpen);

        const discountCopy =
            plan.give_discount && String(plan.discount_description || "").trim()
                ? String(plan.discount_description).trim()
                : "";
        const open = state.invoiceDropdownOpen;
        const activeLabel = formatInvoiceOptionLabel(activeOption);

        const listItems = options
            .map((opt) => {
                const selected = String(opt.id) === String(activeOption?.id);
                const save =
                    plan.give_discount && opt.give_discount && opt.discount_amount
                        ? `<span class="ri-option-save">Save ${escapeHtml(
                              String(Number(opt.discount_amount))
                          )}%</span>`
                        : "";
                return `
                    <li role="presentation">
                        <button
                            type="button"
                            class="ri-option${selected ? " ri-option--selected" : ""}"
                            data-invoice-option="${escapeHtml(String(opt.id))}"
                            role="option"
                            aria-selected="${selected ? "true" : "false"}"
                        >
                            <span class="ri-option-label">${escapeHtml(opt.label || "")}</span>
                            ${save}
                        </button>
                    </li>`;
            })
            .join("");

        root.innerHTML = `
            <style>${invoiceDropdownCss()}</style>
            <div class="ri-widget" data-subscribify-invoice="true">
                <div class="ri-dropdown${open ? " ri-dropdown--open" : ""}">
                    <button
                        type="button"
                        class="ri-trigger"
                        data-invoice-toggle
                        aria-haspopup="listbox"
                        aria-expanded="${open ? "true" : "false"}"
                    >
                        <span class="ri-trigger-text">${escapeHtml(activeLabel)}</span>
                        <span class="ri-trigger-caret" aria-hidden="true"></span>
                    </button>
                    <ul class="ri-menu" role="listbox"${open ? "" : " hidden"}>
                        ${listItems}
                    </ul>
                </div>
                ${
                    discountCopy
                        ? `<p class="ri-discount-copy">${escapeHtml(discountCopy)}</p>`
                        : ""
                }
            </div>`;

        bindInvoiceInteractions(root, settings, state);
        syncInvoiceProperties(state);
        clearSellingPlanInput();
    }

    function invoiceDropdownCss() {
        return `
.ri-widget{box-sizing:border-box;width:100%;margin:0 0 1rem;font-family:inherit;color:#111827}
.ri-widget *,.ri-widget *::before,.ri-widget *::after{box-sizing:border-box}
.ri-dropdown{position:relative;width:100%}
.ri-trigger{
  width:100%;display:flex;align-items:center;justify-content:space-between;gap:.75rem;
  padding:.9rem 1rem;border:1.5px solid #d1d5db;border-radius:12px;background:#fff;
  box-shadow:0 1px 2px rgba(16,24,40,.05);font:inherit;font-size:.95rem;font-weight:600;
  color:#111827;cursor:pointer;text-align:left
}
.ri-trigger:hover{border-color:#9ca3af}
.ri-dropdown--open .ri-trigger{
  border-color:#111827;box-shadow:0 0 0 3px rgba(17,24,39,.12)
}
.ri-trigger-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ri-trigger-caret{
  width:.55rem;height:.55rem;flex-shrink:0;border-right:2px solid #6b7280;border-bottom:2px solid #6b7280;
  transform:rotate(45deg) translateY(-2px);transition:transform .15s ease
}
.ri-dropdown--open .ri-trigger-caret{transform:rotate(225deg) translateY(-1px)}
.ri-menu{
  list-style:none;margin:0;position:absolute;z-index:40;left:0;right:0;top:calc(100% + 6px);
  display:flex;flex-direction:column;gap:.15rem;padding:.4rem;border:1.5px solid #d1d5db;
  border-radius:12px;background:#fff;box-shadow:0 14px 30px rgba(16,24,40,.16);max-height:240px;overflow:auto
}
.ri-menu[hidden]{display:none !important}
.ri-option{
  appearance:none;border:0;background:transparent;width:100%;display:flex;align-items:center;
  justify-content:space-between;gap:.75rem;padding:.7rem .8rem;border-radius:8px;cursor:pointer;
  font:inherit;font-size:.92rem;color:#111827;text-align:left
}
.ri-option:hover{background:#f3f4f6}
.ri-option--selected{background:#111827;color:#fff}
.ri-option--selected .ri-option-save{background:rgba(255,255,255,.18);color:#fff}
.ri-option-label{font-weight:600}
.ri-option-save{
  flex-shrink:0;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;
  font-size:.72rem;font-weight:700
}
.ri-discount-copy{
  margin:.75rem 0 0;padding:.75rem .9rem;border-radius:10px;background:#f8fafc;
  border-left:3px solid #111827;font-size:.9rem;font-style:italic;line-height:1.45;color:#374151
}`;
    }

    function formatInvoiceOptionLabel(option) {
        if (!option) return "Select interval";
        return option.label || "Select interval";
    }

    function bindInvoiceInteractions(root, settings, state) {
        const toggle = root.querySelector("[data-invoice-toggle]");
        if (toggle) {
            toggle.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                state.invoiceDropdownOpen = !state.invoiceDropdownOpen;
                renderInvoice(root, settings, state);
            });
        }

        root.querySelectorAll("[data-invoice-option]").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                state.selectedId = "subscribe";
                state.selectedOptionId = String(btn.dataset.invoiceOption);
                state.invoiceDropdownOpen = false;
                log("SELECT", "Invoice interval changed", {
                    optionId: state.selectedOptionId,
                });
                renderInvoice(root, settings, state);
            });
        });
    }

    function getCurrentVariantId() {
        const form = getProductForm();
        const input = form?.querySelector('[name="id"]');
        return input?.value ? String(input.value) : null;
    }

    function normalizeIdSet(ids) {
        const set = new Set();
        (ids || []).forEach((id) => {
            const raw = String(id || "").trim();
            if (!raw) return;
            set.add(raw);
            const numeric = raw.includes("gid://")
                ? String(parseInt(raw.split("/").pop(), 10) || "")
                : String(raw.replace(/\D+/g, "") || "");
            if (numeric) {
                set.add(numeric);
                set.add(`gid://shopify/ProductVariant/${numeric}`);
            }
        });
        return set;
    }

    function invoiceAllowsVariant(plan, variantId) {
        const allowed = normalizeIdSet(plan?.variant_ids || []);
        if (!allowed.size) {
            // No variant rows stored — treat as product-level (show).
            return true;
        }
        const candidates = normalizeIdSet([variantId]);
        for (const id of candidates) {
            if (allowed.has(id)) return true;
        }
        return false;
    }

    function applyInvoiceVisibility(mount, root, settings, state) {
        const allowed = invoiceAllowsVariant(state.invoicePlan, state.variantId);

        if (!allowed) {
            mount.style.display = "none";
            root.innerHTML = "";
            clearInvoicePropertiesOnAllForms();
            clearSellingPlanInput();
            log("VARIANT", "Invoice widget hidden — variant not on plan", {
                variantId: state.variantId,
            });
            return;
        }

        mount.style.display = "";
        renderInvoice(root, settings, state);
        log("VARIANT", "Invoice widget shown for variant", { variantId: state.variantId });
    }

    function clearInvoicePropertiesOnAllForms() {
        const forms = Array.from(
            document.querySelectorAll('form[action*="/cart/add"], form.product-form')
        ).filter((form) => !isInstallmentsForm(form));
        forms.forEach((form) => clearInvoiceProperties(form));
    }

    function watchVariantChangesInvoice(mount, root, settings, state) {
        const form = getProductForm();
        if (!form) return;

        const variantInput = form.querySelector('[name="id"]');
        if (!variantInput) return;

        const onVariantChange = () => {
            state.variantId = String(variantInput.value || state.variantId);
            applyInvoiceVisibility(mount, root, settings, state);
        };

        variantInput.addEventListener("change", onVariantChange);

        // Many themes update variant via events / Shopify events.
        document.addEventListener("change", (event) => {
            if (event.target === variantInput || event.target?.name === "id") {
                onVariantChange();
            }
        });
    }

    const INVOICE_PROPERTY_KEYS = [
        "_subscribify_plan_type",
        "_subscribify_plan_id",
        "_subscribify_plan_option_id",
        "_subscribify_discount_amount",
        "_subscribify_discount_type",
        "Interval",
        "Discount",
        "Discount description",
    ];

    function findOrCreatePropertyInput(form, key) {
        const name = `properties[${key}]`;
        let input = form.querySelector(`input[name="${name}"]`);

        if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.setAttribute("data-subscribify-prop", key);
            form.appendChild(input);
        }

        return input;
    }

    function clearInvoiceProperties(form) {
        INVOICE_PROPERTY_KEYS.forEach((key) => {
            const input =
                form.querySelector(`input[name="properties[${key}]"]`) ||
                form.querySelector(`input[data-subscribify-prop="${key}"]`);
            if (input) {
                input.value = "";
                input.remove();
            }
        });
    }

    function syncInvoiceProperties(state) {
        const forms = Array.from(
            document.querySelectorAll('form[action*="/cart/add"], form.product-form')
        ).filter((form) => !isInstallmentsForm(form));
        const primary = getProductForm();
        if (primary && !forms.includes(primary)) forms.unshift(primary);

        if (!forms.length) {
            warn("FORM", "Could not find product form for invoice properties");
            return;
        }

        if (!invoiceAllowsVariant(state.invoicePlan, state.variantId)) {
            forms.forEach((form) => clearInvoiceProperties(form));
            return;
        }

        const subscribe = state.selectedId !== "one-time";
        const plan = state.invoicePlan;
        const option =
            plan?.options?.find((o) => String(o.id) === String(state.selectedOptionId)) ||
            plan?.options?.[0];

        forms.forEach((form) => {
            if (!subscribe || !plan || !option) {
                clearInvoiceProperties(form);
                return;
            }

            const values = {
                _subscribify_plan_type: "recurring_invoice",
                _subscribify_plan_id: String(plan.plan_id),
                _subscribify_plan_option_id: String(option.id),
                Interval: option.label || "",
            };

            if (plan.give_discount) {
                const amount = option.discount_amount ?? plan.discount_amount;
                const type = option.discount_type || plan.discount_type || "Percentage off";
                if (amount != null && amount !== "") {
                    values._subscribify_discount_amount = String(amount);
                    values.Discount =
                        String(type).toLowerCase().includes("percent")
                            ? `${Number(amount)}%`
                            : String(amount);
                }
                if (type) {
                    values._subscribify_discount_type = String(type);
                }
                if (plan.discount_description) {
                    values["Discount description"] = String(plan.discount_description);
                }
            }

            // Remove stale discount keys when discount is off.
            clearInvoiceProperties(form);
            Object.entries(values).forEach(([key, value]) => {
                const input = findOrCreatePropertyInput(form, key);
                input.value = value;
            });
        });

        log("FORM", subscribe ? "Invoice properties assigned" : "Invoice properties cleared", {
            optionId: option?.id ?? null,
            variantId: state.variantId,
            giveDiscount: Boolean(plan?.give_discount),
            formsUpdated: forms.length,
        });
    }

    function clearSellingPlanInput() {
        const forms = Array.from(
            document.querySelectorAll('form[action*="/cart/add"], form.product-form')
        ).filter((form) => !isInstallmentsForm(form));

        forms.forEach((form) => {
            const input =
                form.querySelector('input[name="selling_plan"]') ||
                form.querySelector('input[data-subscribify-selling-plan="true"]');
            if (input) {
                input.value = "";
                input.removeAttribute("value");
            }
        });
    }

    function findOrCreateSellingPlanInput(form) {
        if (!form) return null;

        let input =
            form.querySelector('input[name="selling_plan"]') ||
            form.querySelector('input[name="properties[selling_plan]"]');

        if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = "selling_plan";
            input.setAttribute("data-subscribify-selling-plan", "true");
            form.appendChild(input);
        }

        return input;
    }

    function syncSellingPlanInput(state) {
        const forms = Array.from(document.querySelectorAll('form[action*="/cart/add"], form.product-form')).filter(
            (form) => !isInstallmentsForm(form)
        );
        const primary = getProductForm();
        if (primary && !forms.includes(primary)) forms.unshift(primary);

        if (!forms.length) {
            warn("FORM", "Could not find product form for selling_plan input");
            return;
        }

        forms.forEach((form) => {
            const input = findOrCreateSellingPlanInput(form);
            if (!input) return;

            if (state.selectedId === "one-time") {
                input.value = "";
                input.removeAttribute("value");
            } else {
                input.value = state.selectedId;
            }

            input.dispatchEvent(new Event("change", { bubbles: true }));
        });

        log(
            "FORM",
            state.selectedId === "one-time" ? "selling_plan cleared (one-time purchase)" : "selling_plan assigned",
            {
                sellingPlanId: state.selectedId === "one-time" ? null : state.selectedId,
                formsUpdated: forms.length,
                formAction: primary?.action,
            }
        );
    }

    function bindSellingPlanSync(state) {
        syncSellingPlanInput(state);
    }

    function watchVariantChanges(mount, root, template, settings, state) {
        const form = getProductForm();
        if (!form) {
            warn("VARIANT", "Product form not found — variant change listener skipped");
            return;
        }

        const variantInput = form.querySelector('[name="id"]');
        if (!variantInput) {
            warn("VARIANT", 'Variant input [name="id"] not found');
            return;
        }

        log("VARIANT", "Watching variant changes", { initialVariantId: variantInput.value });

        const onVariantChange = () => {
            const nextId = String(variantInput.value);
            log("VARIANT", "Variant changed", { variantId: nextId });

            if (!state.productData.variants?.[nextId]) {
                warn("VARIANT", "Variant not in widget data", { variantId: nextId });
                return;
            }

            state.variantId = nextId;

            const variant = state.productData.variants[nextId];
            if (!variant.allocations?.length) {
                warn("VARIANT", "New variant has no selling plans — hiding widget", { variantId: nextId });
                state.selectedId = "one-time";
                root.innerHTML = "";
                syncSellingPlanInput(state);
                mount.style.display = "none";
                return;
            }

            mount.style.display = "";
            const firstPlanId = String(variant.allocations[0].sellingPlanId);
            if (state.selectedId !== "one-time") {
                const stillValid = variant.allocations.some((a) => String(a.sellingPlanId) === state.selectedId);
                if (!stillValid) state.selectedId = firstPlanId;
            }

            render(root, template, settings, state);
        };

        variantInput.addEventListener("change", onVariantChange);
        document.addEventListener("variant:change", (event) => {
            const variant = event.detail?.variant;
            if (variant?.id) {
                variantInput.value = variant.id;
                onVariantChange();
            }
        });
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
