export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function bookingApi<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/transfer/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data?.error === "string"
        ? data.error
        : typeof data?.code === "string"
          ? data.code
          : "REQUEST_FAILED",
    );
  return data as T;
}
