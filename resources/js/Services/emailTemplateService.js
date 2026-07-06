import api from "./api";

export const getEmailTemplates = () => api.get("selling/email-templates");

export const getEmailTemplate = (key) => api.get(`selling/email-templates/${key}`);

export const updateEmailTemplate = (key, payload) =>
    api.put(`selling/email-templates/${key}`, payload);

export const toggleEmailTemplate = (key, enabled) =>
    api.post(`selling/email-templates/${key}/toggle`, { enabled });

export const resetEmailTemplate = (key) => api.post(`selling/email-templates/${key}/reset`);

export const sendEmailTemplateTest = (key, payload = {}) =>
    api.post(`selling/email-templates/${key}/send-test`, payload);
