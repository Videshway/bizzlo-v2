import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

export const siteUrl = () => Deno.env.get("SITE_URL") || "https://bizzlo.co";

export function requestId(request: Request) {
  return request.headers.get("x-bizzlo-request-id") || crypto.randomUUID();
}

export function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "0.0.0.0";
}

export function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin") || siteUrl();
  if (origin === siteUrl() || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin;
  return siteUrl();
}

export function corsHeaders(request: Request, extra: HeadersInit = {}) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(request),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bizzlo-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "X-Bizzlo-Request-Id": requestId(request),
    ...extra,
  };
}

export function json(request: Request, body: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, extra), "content-type": "application/json" },
  });
}

export function env() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase function environment.");
  return { supabaseUrl, anonKey, serviceRoleKey };
}

export function adminClient() {
  const { supabaseUrl, serviceRoleKey } = env();
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export function userClient(authorization: string) {
  const { supabaseUrl, anonKey } = env();
  if (!anonKey) throw new Error("Missing Supabase anon key.");
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function checkRateLimit(client: ReturnType<typeof createClient>, request: Request, endpoint: string, maxPerMinute: number) {
  const bucket = await sha256Hex(`${clientIp(request)}:${endpoint}:${new Date().toISOString().slice(0, 16)}`);
  const { data, error } = await client.rpc("edge_check_rate_limit", {
    bucket,
    max_count: maxPerMinute,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function verifyTurnstile(request: Request, token: string | null | undefined) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return { ok: false, error: "Human verification is not configured." };
  if (!token) return { ok: false, error: "Human verification is required." };

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", clientIp(request));

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  return result.success ? { ok: true } : { ok: false, error: "Human verification failed." };
}

export function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

export function portalCookie(uploadToken: string) {
  return `bizzlo_portal=${encodeURIComponent(uploadToken)}; HttpOnly; Secure; SameSite=None; Path=/functions/v1; Max-Age=7200`;
}

export async function sendOtpEmail(email: string, code: string, studentName: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Bizzlo <support@bizzlo.co>";
  if (!resendKey) throw new Error("OTP email provider is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Bizzlo document upload code",
      html: `<p>Hello ${studentName || "there"},</p><p>Your Bizzlo upload code is <strong>${code}</strong>. It expires in 10 minutes.</p><p>If you did not request this, please ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OTP email failed: ${details}`);
  }
}

export function logEdgeEvent(request: Request, event: string, metadata: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    event,
    request_id: requestId(request),
    ip_hash_hint: clientIp(request).slice(0, 7),
    ...metadata,
  }));
}

