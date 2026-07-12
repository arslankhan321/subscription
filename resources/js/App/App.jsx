import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SideBarMenu from "../Components/SideBarMenu/SideBarMenu.jsx";
import PageLoader from "../Components/PageLoader.jsx";
import "@/styles/page-loader.css";

const Dashboard = React.lazy(() => import("../Pages/Dashboard/Dashboard.jsx"));
const Plans = React.lazy(() => import("../Pages/Plans/Index.jsx"));
const Subscriptions = React.lazy(() => import("../Pages/Subscriptions/Index.jsx"));
const SubscriptionCreate = React.lazy(() => import("../Pages/Subscriptions/Create.jsx"));
const SubscriptionShow = React.lazy(() => import("../Pages/Subscriptions/Show.jsx"));
const SubscriptionEdit = React.lazy(() => import("../Pages/Subscriptions/Edit.jsx"));
const Widgets = React.lazy(() => import("../Pages/Widgets/Index.jsx"));
const Settings = React.lazy(() => import("../Pages/Settings/Index.jsx"));

function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader label="Loading" message="Loading..." />}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/subscriptions" element={<Subscriptions />} />
                <Route path="/subscriptions/create" element={<SubscriptionCreate />} />
                <Route path="/subscriptions/:id/edit" element={<SubscriptionEdit />} />
                <Route path="/subscriptions/:id" element={<SubscriptionShow />} />
                <Route path="/widgets" element={<Widgets />} />
                <Route path="/settings" element={<Settings />} />
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