/**
 * Runs once when the server process starts (Next.js instrumentation hook).
 *
 * Logs configuration problems by variable NAME only — never values — so a
 * misconfigured deployment is obvious in the platform logs right away,
 * instead of surfacing later as a confusing failure on the first user
 * request. It never throws and never blocks startup: local development and
 * CI legitimately run without every secret, and each server operation
 * still fails with its own clear error when it actually needs a missing one.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getEnvIssues } = await import("./lib/env");
  const issues = getEnvIssues();
  if (issues.length === 0) return;

  for (const issue of issues) {
    const log = issue.severity === "error" ? console.error : console.warn;
    log(`[config] ${issue.severity.toUpperCase()} ${issue.name}: ${issue.message}`);
  }
}
