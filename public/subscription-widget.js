/**
 * Subscribify storefront widget — Shadow DOM loader.
 * Mount: #subscription-widget with data-widget-name + data-app-url
 * Plans: #subscription-widget-data JSON (from theme extension block)
 */
(function () {
    "use strict";

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

        log("INIT", "Mount element found", {
            widgetName: mount.dataset.widgetName || "(auto-active)",
            appUrl: mount.dataset.appUrl || "(from script)",
        });

        const widgetName = (mount.dataset.widgetName || "").trim();
        const appOrigin = normalizeOrigin(mount.dataset.appUrl || getScriptOrigin());
        if (!appOrigin) {
            error("CONFIG", "Missing app URL — set App URL in theme block settings");
            return;
        }

        log("CONFIG", "Resolved app origin", { appOrigin, widgetName: widgetName || "(auto-active)" });

        const productData = parseProductData();
        if (!productData) {
            error("PRODUCT", "No selling plans found — check plan is published and product is attached in Subscribify");
            return;
        }

        log("PRODUCT", "Product data parsed", {
            selectedVariantId: productData.selectedVariantId,
            variantCount: Object.keys(productData.variants || {}).length,
            allocationCount: productData.variants?.[String(productData.selectedVariantId)]?.allocations?.length ?? 0,
            plans: (productData.variants?.[String(productData.selectedVariantId)]?.allocations || []).map((a) => ({
                id: a.sellingPlanId,
                name: a.name,
            })),
        });

        placeWidgetNearForm(mount);

        const shadow = mount.attachShadow({ mode: "open" });
        const root = document.createElement("div");
        root.className = "sw-shadow-root";
        shadow.appendChild(root);
        root.innerHTML = `<div class="po-root"><div class="po-widget" style="padding:1rem;color:#6b7280;">Loading subscription options…</div></div>`;

        const state = {
            selectedId: "one-time",
            variantId: String(productData.selectedVariantId),
            productData,
        };

        const cssUrl = `${appOrigin}/storefront/widget.css`;

        log("FETCH", "Loading widget config + CSS", {
            widgetUrl: widgetName
                ? `${appOrigin}/storefront/widgets/${encodeURIComponent(widgetName)}`
                : `${appOrigin}/storefront/widgets/active`,
            cssUrl,
        });

        loadWidgetConfig(appOrigin, widgetName)
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

                log("RENDER", "Rendering widget", {
                    name: widget.name,
                    template: widget.template,
                    status: "active",
                });

                render(root, widget.template, settings, state);
                bindSellingPlanSync(state);
                watchVariantChanges(mount, root, widget.template, settings, state);

                log("DONE", "Widget ready");
            })
            .catch((fetchError) => {
                error("FETCH", "Failed to load widget config", fetchError);
                mount.remove();
            });
    }

    async function loadWidgetConfig(appOrigin, widgetName) {
        if (widgetName) {
            const namedUrl = `${appOrigin}/storefront/widgets/${encodeURIComponent(widgetName)}`;
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

        const activeUrl = `${appOrigin}/storefront/widgets/active`;
        log("FETCH", "Trying active widget", { url: activeUrl });
        return fetchJson(activeUrl);
    }

    function normalizeOrigin(url) {
        if (!url) return "";
        try {
            return new URL(url).origin;
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

    function parseProductData() {
        const node = document.getElementById(DATA_ID);
        if (!node) {
            warn("PRODUCT", `#${DATA_ID} JSON script not found — Liquid block did not render product plans`);
            return null;
        }

        try {
            const data = JSON.parse(node.textContent);
            const selectedKey = String(data.selectedVariantId);
            let variant = data.variants?.[selectedKey];

            log("PRODUCT", "Raw product JSON parsed", {
                selectedVariantId: selectedKey,
                variants: Object.keys(data.variants || {}).map((id) => ({
                    id,
                    allocations: data.variants[id]?.allocations?.length ?? 0,
                })),
            });

            if (!variant?.allocations?.length) {
                warn("PRODUCT", `Selected variant ${selectedKey} has no allocations, searching fallback variant`);
                const fallbackKey = Object.keys(data.variants || {}).find((key) => {
                    return (data.variants[key]?.allocations?.length ?? 0) > 0;
                });

                if (!fallbackKey) {
                    error("PRODUCT", "No variant has selling plan allocations", data.variants);
                    return null;
                }

                log("PRODUCT", `Using fallback variant ${fallbackKey}`);
                data.selectedVariantId = fallbackKey;
                variant = data.variants[fallbackKey];
            }

            return data;
        } catch (parseError) {
            error("PRODUCT", "Invalid product JSON in theme block", parseError);
            return null;
        }
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

    function getProductForm() {
        return (
            document.querySelector('form[action*="/cart/add"]') ||
            document.querySelector("form.product-form") ||
            document.querySelector('form[id*="product"]')
        );
    }

    function placeWidgetNearForm(mount) {
        const form = getProductForm();
        if (!form?.parentNode) {
            warn("PLACE", "Product form not found — widget stays in default position");
            return;
        }

        const buyBox =
            form.closest(".product__info-wrapper") ||
            form.closest(".product__info") ||
            form.closest(".product-single__meta") ||
            form.closest("[data-product-form]") ||
            form.parentElement;

        if (buyBox && buyBox !== mount.parentNode) {
            buyBox.insertBefore(mount, form);
            log("PLACE", "Widget moved before product form", { container: buyBox.className || buyBox.tagName });
            return;
        }

        if (form.parentNode) {
            form.parentNode.insertBefore(mount, form);
            log("PLACE", "Widget inserted before form parent");
        }
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
        const form = getProductForm();
        const input = findOrCreateSellingPlanInput(form);
        if (!input) {
            warn("FORM", "Could not find or create selling_plan hidden input");
            return;
        }

        if (state.selectedId === "one-time") {
            input.value = "";
            input.removeAttribute("value");
            log("FORM", "selling_plan cleared (one-time purchase)", {
                formAction: form?.action,
                inputName: input.name,
            });
        } else {
            input.value = state.selectedId;
            log("FORM", "selling_plan assigned", {
                sellingPlanId: state.selectedId,
                formAction: form?.action,
                inputName: input.name,
            });
        }

        input.dispatchEvent(new Event("change", { bubbles: true }));
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
