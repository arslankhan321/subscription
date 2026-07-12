import api from "./api";

export const getSubscriptions = (params = {}) => {
    return api.get("selling/subscriptions", { params });
};

export const getSubscription = (id) => {
    return api.get(`selling/subscriptions/${id}`);
};

export const getSubscriptionBillingCycles = (id, params = {}) => {
    return api.get(`selling/subscriptions/${id}/cycles`, { params });
};

export const chargeSubscriptionCycle = (id, cycleIndex) => {
    return api.post(`selling/subscriptions/${id}/cycles/${cycleIndex}/charge`);
};

export const skipSubscriptionCycle = (id, cycleIndex) => {
    return api.post(`selling/subscriptions/${id}/cycles/${cycleIndex}/skip`);
};

export const unskipSubscriptionCycle = (id, cycleIndex) => {
    return api.post(`selling/subscriptions/${id}/cycles/${cycleIndex}/unskip`);
};

export const rescheduleSubscriptionCycle = (id, cycleIndex, billingDate) => {
    return api.post(`selling/subscriptions/${id}/cycles/${cycleIndex}/reschedule`, {
        billing_date: billingDate,
    });
};
