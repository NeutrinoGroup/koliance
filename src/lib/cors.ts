/**
 * CORS for the Next.js API routes (issue #35 P0-1).
 *
 * `Access-Control-Allow-Origin: *` let any web page drive these routes from a
 * visitor's browser. Only origins listed in KOLIANCE_ALLOWED_ORIGINS
 * (comma-separated; NEXT_PUBLIC_SITE_URL is also accepted) are echoed back.
 * Same-origin requests from the app itself need no CORS header at all.
 */
export function allowedOrigins(): string[] {
  const raw = [process.env.KOLIANCE_ALLOWED_ORIGINS, process.env.NEXT_PUBLIC_SITE_URL]
    .filter(Boolean)
    .join(",");
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function corsHeadersFor(request: Request | null, methods: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  const origin = request?.headers.get("origin");
  if (origin && allowedOrigins().includes(origin.replace(/\/+$/, ""))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
