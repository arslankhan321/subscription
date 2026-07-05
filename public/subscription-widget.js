/**
 * Storefront subscription widget embed loader.
 * Usage on theme product page:
 * <div id="subscription-widget" data-widget-name="My Widget Name"></div>
 * <script src="https://YOUR_APP_URL/subscription-widget.js" defer></script>
 */
(function () {
    const mount = document.getElementById("subscription-widget");
    if (!mount) return;

    const widgetName = mount.dataset.widgetName;
    if (!widgetName) return;

    const appOrigin = document.currentScript?.src
        ? new URL(document.currentScript.src).origin
        : window.location.origin;

    fetch(`${appOrigin}/storefront/widgets/${encodeURIComponent(widgetName)}`)
        .then((response) => response.json())
        .then((payload) => {
            if (!payload?.success || !payload.data) return;

            const { template, settings } = payload.data;
            mount.innerHTML = buildWidgetHtml(template, settings);
            applyStyles(mount, settings);
            bindInteractions(mount);
        })
        .catch(() => {});

    function applyStyles(root, settings) {
        const colors = settings.colors || {};
        const typography = settings.typography || {};
        const border = settings.border || {};

        root.style.setProperty("--sw-primary", colors.primary || "#008060");
        root.style.setProperty("--sw-secondary", colors.secondary || "#f6f6f7");
        root.style.setProperty("--sw-text", colors.text || "#202223");
        root.style.setProperty("--sw-border", colors.border || "#e3e5e7");
        root.style.setProperty("--sw-accent", colors.accent || "#22a57a");
        root.style.setProperty("--sw-badge-payg", colors.badgePayg || "#5c6ac4");
        root.style.setProperty("--sw-badge-prepaid", colors.badgePrepaid || "#b98900");
        root.style.setProperty("--sw-bg", colors.background || "#ffffff");
        root.style.setProperty("--sw-font", typography.fontFamily || "inherit");
        root.style.setProperty("--sw-title-size", `${typography.titleSize || 16}px`);
        root.style.setProperty("--sw-body-size", `${typography.bodySize || 14}px`);
        root.style.setProperty("--sw-font-weight", typography.fontWeight || "600");
        root.style.setProperty("--sw-border-width", `${border.width || 1}px`);
        root.style.setProperty("--sw-border-radius", `${border.radius || 12}px`);
        root.style.setProperty("--sw-border-style", border.style || "solid");
        root.className = "sw-widget-root";
    }

    function bindInteractions(root) {
        root.querySelectorAll("[data-option-id]").forEach((element) => {
            element.addEventListener("click", () => {
                root.querySelectorAll("[data-option-id]").forEach((item) => {
                    item.classList.remove("sw-option--selected", "sw-modern-card--active", "sw-pill--active", "sw-stack-card--active", "sw-minimal-row--active");
                });
                element.classList.add(
                    element.classList.contains("sw-option") ? "sw-option--selected" : "sw-modern-card--active"
                );
            });
        });
    }

    function buildWidgetHtml(template, settings) {
        const labels = settings.labels || {};
        const title = labels.title || "Subscribe & Save";
        return `<div class="sw-template sw-template--${template}"><div class="sw-template__title">${title}</div><div class="sw-option sw-option--selected" data-option-id="subscribe"><div class="sw-option__content"><div class="sw-option__row"><span class="sw-option__name">${labels.subscribe || "Subscribe"}</span></div></div></div></div>`;
    }
})();
