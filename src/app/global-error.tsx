"use client";

// Root error boundary — the ONLY boundary that catches errors thrown by the
// root layout itself (src/app/layout.tsx). It replaces the whole document when
// active, so it must render its own <html>/<body> and stay self-contained (no
// providers, no global CSS dependency — use inline styles).

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Last-resort logging. Wire a crash reporter here (see docs/LAUNCH_CHECKLIST.md).
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          color: "#101828",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#475467", margin: "0 0 20px", lineHeight: 1.6 }}>
            An unexpected error occurred. Please try again — if it keeps happening, contact support.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#1570EF",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ fontSize: 11, color: "#98a2b3", marginTop: 16 }}>Reference: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
