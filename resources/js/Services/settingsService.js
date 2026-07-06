import api from "./api";

export const getShopSettings = () => api.get("selling/settings");

export const updateShopSettings = (payload) => api.put("selling/settings", payload);

export const getInventoryLocations = () => api.get("selling/settings/inventory-locations");
