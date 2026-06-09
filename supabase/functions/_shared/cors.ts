// Shared CORS headers + JSON helper for the auto.dev proxy Edge Functions.
// Native React Native doesn't enforce CORS, but the inspector app's web export
// (react-native-web) runs in a browser, so we send proper CORS headers and
// answer preflight OPTIONS.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Pass an upstream JSON string through unchanged, with CORS headers. */
export function passthrough(text: string, status: number): Response {
  return new Response(text, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
