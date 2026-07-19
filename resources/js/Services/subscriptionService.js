import api from "./api";

export const createSubscription = (payload) => {
    return api.post("selling/subscriptions", payload);
};

export const getSubscriptionCreateMeta = () => {
    return api.get("selling/subscriptions/create-meta");
};

export const searchSubscriptionCustomers = (query) => {
    return api.get("selling/subscriptions/customers/search", {
        params: { query },
    });
};

export const getCustomerPaymentMethodsForCreate = (customerId) => {
    return api.get("selling/subscriptions/customers/payment-methods", {
        params: { customer_id: customerId },
    });
};

export const getCustomerAddressesForCreate = (customerId) => {
    return api.get("selling/subscriptions/customers/addresses", {
        params: { customer_id: customerId },
    });
};

export const getSubscriptions = (params = {}) => {
    return api.get("selling/subscriptions", { params });
};

export const getSubscription = (id) => {
    return api.get(`selling/subscriptions/${id}`);
};

export const updateSubscription = (id, payload) => {
    return api.post(`selling/subscriptions/${id}`, payload);
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

export const getSubscriptionFulfillments = (id) => {
    return api.get(`selling/subscriptions/${id}/fulfillments`);
};

export const rescheduleSubscriptionFulfillment = (id, fulfillmentOrderId, fulfillAt) => {
    return api.post(`selling/subscriptions/${id}/fulfillments/reschedule`, {
        fulfillment_order_id: fulfillmentOrderId,
        fulfill_at: fulfillAt,
    });
};

export const skipSubscriptionFulfillment = (id, fulfillmentOrderId) => {
    return api.post(`selling/subscriptions/${id}/fulfillments/skip`, {
        fulfillment_order_id: fulfillmentOrderId,
    });
};

export const refundSubscriptionFulfillment = (id, fulfillmentOrderId) => {
    return api.post(`selling/subscriptions/${id}/fulfillments/refund`, {
        fulfillment_order_id: fulfillmentOrderId,
    });
};

export const addSubscriptionDiscount = (id, payload) => {
    return api.post(`selling/subscriptions/${id}/discounts`, payload);
};

export const removeSubscriptionDiscount = (id, discountId) => {
    return api.post(`selling/subscriptions/${id}/discounts/remove`, {
        discount_id: discountId,
    });
};

export const getSubscriptionPaymentMethods = (id) => {
    return api.get(`selling/subscriptions/${id}/payment-methods`);
};

export const sendSubscriptionPaymentMethodUpdate = (id) => {
    return api.post(`selling/subscriptions/${id}/payment-methods/send-update`);
};

export const swapSubscriptionPaymentMethod = (id, paymentMethodId) => {
    return api.post(`selling/subscriptions/${id}/payment-methods/swap`, {
        payment_method_id: paymentMethodId,
    });
};

export const getSubscriptionAddresses = (id) => {
    return api.get(`selling/subscriptions/${id}/addresses`);
};

export const updateSubscriptionShippingAddress = (id, payload) => {
    return api.post(`selling/subscriptions/${id}/shipping-address`, payload);
};

export const syncSubscriptionCustomer = (id) => {
    return api.post(`selling/subscriptions/${id}/customer/sync`);
};

export const pauseSubscription = (id) => {
    return api.post(`selling/subscriptions/${id}/pause`);
};

export const resumeSubscription = (id) => {
    return api.post(`selling/subscriptions/${id}/resume`);
};

export const cancelSubscription = (id) => {
    return api.post(`selling/subscriptions/${id}/cancel`);
};
