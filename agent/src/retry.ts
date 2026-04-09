export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 15000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status;
      const isRetryable = status === 503 || status === 429;

      if (isRetryable && attempt < maxAttempts) {
        const wait = delayMs * attempt;
        console.log(`  ⚠ API error (${status}), waiting ${wait / 1000}s before retry ${attempt}/${maxAttempts - 1}...`);
        await new Promise((res) => setTimeout(res, wait));
      } else {
        console.log(`  ✗ API error (${status}) — giving up after ${attempt} attempt(s).`);
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}
