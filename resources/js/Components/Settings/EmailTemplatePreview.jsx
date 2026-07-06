import { renderEmailVariables } from "@/utils/emailTemplatePreview";

export default function EmailTemplatePreview({ template }) {
    if (!template) {
        return null;
    }

    const settings = template.settings ?? {};
    const bodyHtml = renderEmailVariables(template.bodyHtml ?? "", {});
    const footerHtml = renderEmailVariables(settings.footerText ?? "", {});
    const shippingHtml = renderEmailVariables(settings.shippingText ?? "", {});
    const billingHtml = renderEmailVariables(settings.billingText ?? "", {});

    return (
        <div className="email-preview">
            <div className="email-preview__subject">
                <span className="email-preview__subject-label">Subject</span>
                <strong>{template.subject}</strong>
            </div>

            <div className="email-preview__body">
                <div
                    className="email-preview__html"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />

                {settings.showBtn && (
                    <div className="email-preview__button-wrap">
                        <span
                            className={`email-preview__button${
                                settings.fullWidth ? " email-preview__button--full" : ""
                            }`}
                        >
                            {settings.btnText || "Manage Subscription"}
                        </span>
                    </div>
                )}

                {settings.showItems && (
                    <div className="email-preview__items">
                        <div className="email-preview__items-head">
                            <span>Product</span>
                            <span>{settings.qtyTitle || "Quantity"}</span>
                            <span>Price</span>
                        </div>
                        <div className="email-preview__items-row">
                            <span>Gray hat (example)</span>
                            <span>1</span>
                            <span>$25.00</span>
                        </div>
                        <div className="email-preview__items-row">
                            <span>Black t-shirt (example)</span>
                            <span>2</span>
                            <span>$40.00</span>
                        </div>
                    </div>
                )}

                {settings.showAddresses && (
                    <div className="email-preview__addresses">
                        <div>
                            <strong>{settings.shippingTitle || "Shipping Address"}</strong>
                            <div dangerouslySetInnerHTML={{ __html: shippingHtml }} />
                        </div>
                        <div>
                            <strong>{settings.billingTitle || "Billing Address"}</strong>
                            <div dangerouslySetInnerHTML={{ __html: billingHtml }} />
                        </div>
                    </div>
                )}

                {settings.showOrderDate && (
                    <div className="email-preview__addresses">
                        <div>
                            <strong>{settings.orderDateTitle || "Next Order Date"}</strong>
                            <div>August 15, 2026</div>
                        </div>
                        <div>
                            <strong>{settings.paymentTitle || "Payment Method"}</strong>
                            <div>Visa ending in 4242</div>
                        </div>
                    </div>
                )}

                {settings.footerText && (
                    <div
                        className="email-preview__footer"
                        dangerouslySetInnerHTML={{ __html: footerHtml }}
                    />
                )}
            </div>
        </div>
    );
}
