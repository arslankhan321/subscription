import { useState } from "react";
import WidgetTemplateRenderer from "./WidgetTemplateRenderer";

export default function WidgetLivePreview({ template, settings, layoutName }) {
    const [viewport, setViewport] = useState("desktop");

    return (
        <div className="widget-live-preview">
            <div className="widget-live-preview__toolbar">
                <div className="widget-live-preview__info">
                    <div className="widget-live-preview__label-row">
                        <span className="widget-live-preview__label">Live preview</span>
                        <span className="widget-live-preview__status">
                            <span className="widget-live-preview__dot" />
                            Active
                        </span>
                    </div>
                    {layoutName && (
                        <span className="widget-live-preview__layout">{layoutName}</span>
                    )}
                </div>
                <div className="widget-live-preview__viewport">
                    <button
                        type="button"
                        className={viewport === "desktop" ? "is-active" : ""}
                        onClick={() => setViewport("desktop")}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1" y="2.5" width="12" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M5 11.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        Desktop
                    </button>
                    <button
                        type="button"
                        className={viewport === "mobile" ? "is-active" : ""}
                        onClick={() => setViewport("mobile")}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="3.5" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                            <circle cx="7" cy="11" r="0.6" fill="currentColor" />
                        </svg>
                        Mobile
                    </button>
                </div>
            </div>

            <div
                className={`widget-live-preview__canvas widget-live-preview__canvas--${viewport}`}
            >
                <div className="widget-live-preview__storefront">
                    <div className="widget-live-preview__product-mock">
                        <div className="widget-live-preview__product-image">
                            <span className="widget-live-preview__product-shine" />
                        </div>
                        <div className="widget-live-preview__product-info">
                            <div className="widget-live-preview__product-lines">
                                <span className="widget-live-preview__line widget-live-preview__line--title" />
                                <span className="widget-live-preview__line" />
                                <div className="widget-live-preview__stars">★★★★★</div>
                                <span className="widget-live-preview__line widget-live-preview__line--short" />
                            </div>
                            <div className="widget-live-preview__ghost-btn">Add to cart</div>
                        </div>
                    </div>

                    <div className="widget-live-preview__widget-wrap">
                        <WidgetTemplateRenderer template={template} settings={settings} />
                    </div>
                </div>
            </div>
        </div>
    );
}
