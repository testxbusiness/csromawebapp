const sdkOwnedErrors = new WeakSet<object>()

/** Mark an error thrown after an SDK integration has already captured it. */
export function markSdkOwnedError(error: unknown): void {
  if (error && typeof error === 'object') sdkOwnedErrors.add(error)
}

export function isSdkOwnedError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && sdkOwnedErrors.has(error))
}

export async function runSdkOwnedOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    markSdkOwnedError(error)
    throw error
  }
}
