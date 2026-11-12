export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function settleAbortable<T>(
  request: Promise<T>,
  signal: AbortSignal,
): Promise<T | undefined> {
  try {
    return await request;
  } catch (error) {
    if (signal.aborted || isAbortError(error)) return undefined;
    throw error;
  }
}
