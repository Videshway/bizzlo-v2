import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  adminClient,
  checkRateLimit,
  corsHeaders,
  json,
  logEdgeEvent,
  portalCookie,
  sendOtpEmail,
  sha256Hex,
  verifyTurnstile,
} from "../_shared/security.ts";

const defaultDocuments = [
  "Passport",
  "Class 10 Marksheet",
  "Class 12 Marksheet",
  "Bachelor Transcripts",
  "English Test Score",
  "Statement of Purpose",
  "Resume",
  "Experience Letter",
  "Financial Documents",
];

function normalizeCode(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function otpCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

async function loadInvite(client: ReturnType<typeof adminClient>, studentCode: string, token: string) {
  const tokenHash = await sha256Hex(String(token));
  const { data: invite, error } = await client
    .from("student_invites")
    .select("*, student:students(id, organization_id, student_code, first_name, last_name, email)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!invite) return { status: 404, error: "Invite link was not found." };

  const student = invite.student;
  if (!student || normalizeCode(student.student_code) !== normalizeCode(studentCode)) {
    return { status: 404, error: "Invite does not match this student." };
  }

  const expired = new Date(invite.expires_at).getTime() <= Date.now();
  if (invite.status !== "active" || invite.used_at || expired) {
    return { status: 410, error: "Invite link has expired or was already used." };
  }

  return { invite, student };
}

async function requestOtp(request: Request, body: Record<string, unknown>) {
  const client = adminClient();
  const allowed = await checkRateLimit(client, request, "redeem-student-invite", 10);
  if (!allowed) return json(request, { error: "Too many attempts. Try again in a minute." }, 429);

  const turnstile = await verifyTurnstile(request, String(body.turnstile_token || body["cf-turnstile-response"] || ""));
  if (!turnstile.ok) return json(request, { error: turnstile.error }, 403);

  const loaded = await loadInvite(client, String(body.student_code || ""), String(body.token || ""));
  if ("error" in loaded) return json(request, { error: loaded.error }, loaded.status);

  const code = otpCode();
  const studentName = `${loaded.student.first_name || ""} ${loaded.student.last_name || ""}`.trim();
  await sendOtpEmail(loaded.student.email, code, studentName);

  const { error } = await client.from("student_portal_otps").insert({
    invite_id: loaded.invite.id,
    organization_id: loaded.student.organization_id,
    student_id: loaded.student.id,
    email: loaded.student.email,
    code_hash: await sha256Hex(code),
  });
  if (error) return json(request, { error: error.message }, 400);

  logEdgeEvent(request, "student_portal_otp_sent", { student_id: loaded.student.id });
  return json(request, {
    ok: true,
    email_hint: String(loaded.student.email || "").replace(/^(.{2}).*(@.*)$/, "$1***$2"),
  });
}

async function verifyOtp(request: Request, body: Record<string, unknown>) {
  const client = adminClient();
  const allowed = await checkRateLimit(client, request, "redeem-student-invite", 10);
  if (!allowed) return json(request, { error: "Too many attempts. Try again in a minute." }, 429);

  const loaded = await loadInvite(client, String(body.student_code || ""), String(body.token || ""));
  if ("error" in loaded) return json(request, { error: loaded.error }, loaded.status);

  const { data: otp, error: otpError } = await client
    .from("student_portal_otps")
    .select("*")
    .eq("invite_id", loaded.invite.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (otpError) return json(request, { error: otpError.message }, 400);
  if (!otp) return json(request, { error: "Code expired. Request a new code." }, 410);

  const codeHash = await sha256Hex(String(body.otp || "").trim());
  if (codeHash !== otp.code_hash) {
    const nextAttempts = Number(otp.attempts || 0) + 1;
    await client.from("student_portal_otps").update({ attempts: nextAttempts }).eq("id", otp.id);
    if (nextAttempts >= Number(otp.max_attempts || 3)) {
      await client.from("student_invites").update({ status: "blocked" }).eq("id", loaded.invite.id);
      return json(request, { error: "Too many incorrect codes. Ask your counselor for a new link." }, 403);
    }
    return json(request, { error: "Incorrect code." }, 403);
  }

  const { data: claimedInvite, error: claimError } = await client
    .from("student_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", loaded.invite.id)
    .eq("status", "active")
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) return json(request, { error: claimError.message }, 400);
  if (!claimedInvite) return json(request, { error: "Invite link has expired or was already used." }, 410);

  await client.from("student_portal_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);

  const uploadToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { error: sessionError } = await client.from("student_portal_sessions").insert({
    invite_id: loaded.invite.id,
    organization_id: loaded.student.organization_id,
    student_id: loaded.student.id,
    session_hash: await sha256Hex(uploadToken),
    expires_at: expiresAt,
    status: "active",
    max_uploads: 12,
  });
  if (sessionError) return json(request, { error: sessionError.message }, 400);

  logEdgeEvent(request, "student_invite_redeemed", { student_id: loaded.student.id });
  return json(request, {
    session: {
      access_token: uploadToken,
      expires_in: 7200,
      token_type: "student_upload",
    },
    student: {
      id: loaded.student.id,
      organization_id: loaded.student.organization_id,
      first_name: loaded.student.first_name,
      last_name: loaded.student.last_name,
      email: loaded.student.email,
      required_documents: defaultDocuments,
    },
  }, 200, { "Set-Cookie": portalCookie(uploadToken) });
}

export async function handleRedeemStudentInvite(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "request_otp");
    if (action === "request_otp") return await requestOtp(request, body);
    if (action === "verify_otp") return await verifyOtp(request, body);
    return json(request, { error: "Unsupported portal action." }, 400);
  } catch (error) {
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected portal error." }, 500);
  }
}

serve(handleRedeemStudentInvite);

