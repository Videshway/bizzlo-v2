import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, corsHeaders, json, logEdgeEvent, sha256Hex, userClient } from "../_shared/security.ts";

async function requireAdmin(request: Request) {
  const client = userClient(request.headers.get("authorization") || "");
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { data: profile, error } = await client.from("profiles").select("id, role").eq("id", authData.user.id).single();
  if (error || profile?.role !== "admin") throw new Response(JSON.stringify({ error: "Admin access required." }), { status: 403 });
  return profile;
}

export async function handlePurgeStudent(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
    const admin = await requireAdmin(request);
    const { student_id: studentId } = await request.json().catch(() => ({}));
    if (!studentId) return json(request, { error: "student_id is required." }, 400);

    const client = adminClient();
    const { data: student, error: studentError } = await client.from("students").select("*").eq("id", studentId).single();
    if (studentError || !student) return json(request, { error: "Student not found." }, 404);

    const { data: documents } = await client.from("documents").select("*").eq("student_id", studentId);
    const storagePaths = (documents || []).map((document) => document.storage_path).filter(Boolean);
    if (storagePaths.length) await client.storage.from("student-documents").remove(storagePaths);
    await client.from("documents").delete().eq("student_id", studentId);

    const piiHash = await sha256Hex(`${student.email || ""}:${student.phone || ""}:${studentId}`);
    const anonymizedEmail = `deleted-${piiHash.slice(0, 20)}@bizzlo.invalid`;
    const { error: updateError } = await client.from("students").update({
      first_name: "Deleted",
      last_name: "Student",
      email: anonymizedEmail,
      phone: null,
      status: "profile_incomplete",
    }).eq("id", studentId);
    if (updateError) return json(request, { error: updateError.message }, 400);

    await client.from("data_erasure_events").insert({
      organization_id: student.organization_id,
      student_id: studentId,
      target_type: "student",
      target_id: studentId,
      requested_by: admin.id,
      metadata: { pii_sha256: piiHash, documents_deleted: storagePaths.length },
    });

    logEdgeEvent(request, "student_purged", { student_id: studentId, actor_id: admin.id });
    return json(request, { ok: true, student_id: studentId, documents_deleted: storagePaths.length });
  } catch (error) {
    if (error instanceof Response) return error;
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected purge error." }, 500);
  }
}

serve(handlePurgeStudent);

