import React, { Suspense, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SideBarMenu from "../Components/SideBarMenu/SideBarMenu.jsx";

const Dashboard = React.lazy(() => import("../Pages/Dashboard/Dashboard.jsx"));
const Plans = React.lazy(() => import("../Pages/Plans/Index.jsx"));

function AppRouteLoader() {
    return (
        <div className="app-route-loader" role="status" aria-live="polite" aria-label="Loading">
            <style>{`
                .app-route-loader {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    min-height: 50vh;
                    padding: 2rem 1rem;
                }

                .app-route-loader__spinner {
                    width: 28px;
                    height: 28px;
                    border: 2px solid #e5e7eb;
                    border-top-color: #22a57a;
                    border-radius: 50%;
                    animation: app-route-loader-spin 0.7s linear infinite;
                }

                .app-route-loader__text {
                    margin: 0;
                    color: #6b7280;
                    font-size: 0.8125rem;
                    font-weight: 500;
                }

                @keyframes app-route-loader-spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <span className="app-route-loader__spinner" aria-hidden="true" />
            <p className="app-route-loader__text">Loading...</p>
        </div>
    );
}

function AppRoutes() {
    return (
        <Suspense fallback={<AppRouteLoader />}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/plans" element={<Plans />} />
            </Routes>
        </Suspense>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <SideBarMenu />
            <AppRoutes />
        </BrowserRouter>
    );
}