"use client";

/**
 * Last-resort boundary for failures in the root layout itself, where the
 * app's providers, fonts, and stylesheet may not have loaded — so it
 * renders its own <html>/<body> with inline styles and no app components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#faf8f4",
          color: "#1d2a2e",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div role="alert" style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 20px", color: "#4a5a5f" }}>
            AI Mail Studio hit an unexpected error. Your saved emails are safe.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, fontFamily: "monospace", color: "#4a5a5f" }}>Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 500,
              background: "#0f766e",
              color: "#fff",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
