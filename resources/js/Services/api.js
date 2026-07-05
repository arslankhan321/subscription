import axios from "axios";
import createApp from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge/utilities";
import { getRequestSignal, isAbortError } from "./utils/requestCancellation";

const api = axios.create({
    baseURL: window.location.origin,
    timeout: 60000,
});

let cachedToken = null;
let tokenFetchedAt = 0;

const TOKEN_TTL_MS = 50000;

async function resolveSessionToken() {
    if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
        return cachedToken;
    }

    if (typeof window.shopify?.idToken === "function") {
        cachedToken = await window.shopify.idToken();
        tokenFetchedAt = Date.now();
        return cachedToken;
    }

    const host =
        new URLSearchParams(window.location.search).get("host") ||
        window.__SHOPIFY_DEV_HOST;

    const shop = window.shopify?.config?.shop;

    if (!host || !shop) {
        throw new Error("Shopify session unavailable");
    }

    const app = createApp({
        apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
        host,
        forceRedirect: true,
    });

    cachedToken = await getSessionToken(app);
    tokenFetchedAt = Date.now();

    return cachedToken;
}

api.interceptors.request.use(async (config) => {
    const token = await resolveSessionToken();

    config.headers.Authorization = `Bearer ${token}`;
    config.headers.Accept = "application/json";
    config.headers["Content-Type"] = "application/json";

    if (!config.signal) {
        config.signal = getRequestSignal();
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (isAbortError(error)) {
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default api;