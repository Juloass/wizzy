export async function tryWithError<T>(fn: () => Promise<T>): Promise<[T, null] | [null, unknown]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (err) {
    console.error('Async error:', err);
    return [null, err];
  }
}
