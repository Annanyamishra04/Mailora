import { SupabaseConfigError } from "./errors";

/**
 * Converts a raw Supabase Auth error (or the config error thrown when
 * Supabase isn't set up) into a message safe to show a user. Never passes
 * through raw provider text unfiltered — anything unrecognized falls back
 * to a generic message rather than leaking internals.
 */
export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof SupabaseConfigError) {
    return error.message;
  }

  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "That email or password isn't right.";
  }
  if (message.includes("email not confirmed")) {
    return "Please verify your email before logging in — check your inbox for the confirmation link.";
  }
  if (message.includes("already registered") || message.includes("user already exists")) {
    return "An account with that email already exists. Try logging in instead.";
  }
  if (message.includes("password should be at least") || message.includes("password is too short")) {
    return "Password must be at least 8 characters.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (message.includes("valid email") || message.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "Network error — check your connection and try again.";
  }

  return "Something went wrong. Please try again.";
}
