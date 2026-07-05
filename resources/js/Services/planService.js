import api from "./api";

export const createPlan = (payload) => {
    return api.post("selling/plans", payload);
};

export const updatePlan = (id, payload) => {
    return api.put(`selling/plans/${id}`, payload);
};

export const getPlans = () => {
    return api.get("selling/plans");
};

export const getPlan = (id) => {
    return api.get(`selling/plans/${id}`);
};

export const deletePlan = (id) => {
    return api.delete(`selling/plans/${id}`);
};

export const getShopifyPlanGroups = () => {
    return api.get("selling/plans/shopify");
};