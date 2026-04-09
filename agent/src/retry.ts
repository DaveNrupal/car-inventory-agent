export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  delayMs = 10000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status;
      const isRetryable = status === 503 || status === 429;

      if (isRetryable && attempt < maxAttempts) {
        const wait = delayMs * attempt;
        console.log(`  ⚠ API error (${status}), retrying in ${wait / 1000}s... (attempt ${attempt}/${maxAttempts})`);
        await new Promise((res) => setTimeout(res, wait));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}
