import { toast } from "sonner";

/**
 * Standard error shape returned by our helpers.
 */
export type AppError = {
  message: string;
  code?: string;
  status?: number;
  context?: string;
  original?: unknown;
};

/**
 * Parse any thrown value into a consistent AppError.
 */
export function parseError(err: unknown, context?: string): AppError {
  if (err instanceof Error) {
    // Supabase errors often have a `code` and `message`
    const supaErr = err as Error & { code?: string; status?: number; statusCode?: number };
    return {
      message: supaErr.message || "An unexpected error occurred",
      code: supaErr.code,
      status: supaErr.status || supaErr.statusCode,
      context,
      original: err,
    };
  }

  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    return {
      message: (obj.message as string) || (obj.error as string) || "An unexpected error occurred",
      code: obj.code as string | undefined,
      status: obj.status as number | undefined,
      context,
      original: err,
    };
  }

  return {
    message: typeof err === "string" ? err : "An unexpected error occurred",
    context,
    original: err,
  };
}

/**
 * User-friendly messages for common error codes/statuses.
 */
const friendlyMessages: Record<string, string> = {
  PGRST116: "The requested data was not found.",
  "23505": "This record already exists.",
  "23503": "This action references data that doesn't exist.",
  "42501": "You don't have permission to perform this action.",
  PGRST301: "Too many requests. Please wait a moment.",
  "auth/invalid-credentials": "Invalid email or password.",
  "auth/email-not-confirmed": "Please verify your email before signing in.",
};

const friendlyByStatus: Record<number, string> = {
  400: "Invalid request. Please check your input.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do this.",
  404: "The requested resource was not found.",
  409: "A conflict occurred. The data may have changed.",
  429: "Too many requests. Please try again shortly.",
  500: "Server error. Please try again later.",
  502: "Service temporarily unavailable.",
  503: "Service temporarily unavailable.",
};

/**
 * Get a user-friendly message from an AppError.
 */
export function getFriendlyMessage(error: AppError): string {
  if (error.code && friendlyMessages[error.code]) {
    return friendlyMessages[error.code];
  }
  if (error.status && friendlyByStatus[error.status]) {
    return friendlyByStatus[error.status];
  }
  // Avoid exposing raw Postgres/internal errors to users
  if (error.message.includes("violates") || error.message.includes("PGRST")) {
    return "Something went wrong. Please try again.";
  }
  return error.message;
}

/**
 * Show an error toast with a user-friendly message.
 */
export function showErrorToast(err: unknown, context?: string) {
  const error = parseError(err, context);
  const message = getFriendlyMessage(error);

  console.error(`[AppError]${context ? ` (${context})` : ""}:`, {
    message: error.message,
    code: error.code,
    status: error.status,
    timestamp: new Date().toISOString(),
  });

  toast.error(message, {
    description: context ? `While: ${context}` : undefined,
    duration: 5000,
  });

  return error;
}

/**
 * Wrap an async function with error handling. Returns [data, error].
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<[T, null] | [null, AppError]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (err) {
    const error = showErrorToast(err, context);
    return [null, error];
  }
}

/**
 * Handle Supabase query results — checks for error and throws if present.
 */
export function handleSupabaseError<T>(
  result: { data: T | null; error: { message: string; code?: string; details?: string } | null },
  context?: string
): T {
  if (result.error) {
    const appError = parseError(result.error, context);
    showErrorToast(appError, context);
    throw result.error;
  }
  return result.data as T;
}
