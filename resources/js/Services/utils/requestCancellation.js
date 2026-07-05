/**
 * Returns an AbortSignal for axios/fetch requests.
 * For now every request gets its own controller.
 */

export function getRequestSignal() {
    const controller = new AbortController();

    return controller.signal;
}

/**
 * Checks whether the request was cancelled.
 */
export function isAbortError(error) {
    return (
        error?.name === "AbortError" ||
        error?.code === "ERR_CANCELED" ||
        error?.message === "canceled"
    );
}