import { useCallback, useState } from "react";

const EMPTY_VALIDATION = {
    errors: [],
    fields: {},
    deliveryOptionErrors: [],
    intervalOptionErrors: [],
};

export function useFormValidation() {
    const [validation, setValidation] = useState(EMPTY_VALIDATION);

    const applyValidation = useCallback((result) => {
        setValidation(result);
        return result.errors.length === 0;
    }, []);

    const clearValidation = useCallback(() => {
        setValidation(EMPTY_VALIDATION);
    }, []);

    const clearFieldError = useCallback((field) => {
        setValidation((previous) => {
            if (!previous.fields[field]) {
                return previous;
            }

            const nextFields = { ...previous.fields };
            const message = nextFields[field];
            delete nextFields[field];

            return {
                ...previous,
                fields: nextFields,
                errors: previous.errors.filter((error) => error !== message),
            };
        });
    }, []);

    return {
        validationErrors: validation.errors,
        fieldErrors: validation.fields,
        deliveryOptionErrors: validation.deliveryOptionErrors,
        intervalOptionErrors: validation.intervalOptionErrors,
        applyValidation,
        clearValidation,
        clearFieldError,
    };
}
