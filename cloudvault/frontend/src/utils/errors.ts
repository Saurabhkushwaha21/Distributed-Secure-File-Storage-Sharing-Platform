/**
 * Extracts a human-readable message from an API error, falling back to a
 * caller-supplied default when the response doesn't carry a FastAPI-style
 * `detail` field (network failure, unexpected error shape, etc).
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}
