import api from "./api";

export const getWidgets = () => api.get("selling/widgets");

export const getActiveWidgets = () => api.get("selling/widgets/active");

export const getWidgetDefaults = () => api.get("selling/widgets/defaults");

export const getWidget = (id) => api.get(`selling/widgets/${id}`);

export const createWidget = (payload) => api.post("selling/widgets", payload);

export const updateWidget = (id, payload) => api.put(`selling/widgets/${id}`, payload);

export const deleteWidget = (id) => api.delete(`selling/widgets/${id}`);
