export async function invokeWithRetry(fn, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {

            const isRateLimit =
                err?.status === 429 ||
                err?.message?.includes("rate_limit_exceeded") ||
                err?.message?.includes("tokens per minute");

            if (!isRateLimit || attempt === maxRetries) {
                throw err;
            }

            const waitMs = 35000;

            console.log(
                `[Retry] Rate limited. Waiting ${waitMs / 1000}s before retry ${attempt}/${maxRetries}`
            );

            await new Promise(resolve =>
                setTimeout(resolve, waitMs)
            );
        }
    }
}