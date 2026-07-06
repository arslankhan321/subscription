import api from "./api";

export const getShippingProfiles = () => api.get("selling/shipping-profiles");

export const createShippingProfile = (payload) => api.post("selling/shipping-profiles", payload);

export const assignShippingProfilePlans = (id, payload) =>
    api.put(`selling/shipping-profiles/${id}/plans`, payload);

export const deleteShippingProfile = (id) => api.delete(`selling/shipping-profiles/${id}`);

export const getShopifyShippingSettingsUrl = () =>
    api.get("selling/shipping-profiles/shopify-settings-url");
