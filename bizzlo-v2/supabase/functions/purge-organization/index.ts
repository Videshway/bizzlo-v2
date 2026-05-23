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

export async function handlePurgeOrganization(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
    const admin = await requireAdmin(request);
    const { organization_id: organizationId } = await request.json().catch(() => ({}));
    if (!organizationId) return json(request, { error: "organization_id is required." }, 400);

    const client = adminClient();
    const { data: org, error: orgError } = await client.from("organizations").select("*").eq("id", organizationId).single();
    if (orgError || !org) return json(request, { error: "Organization not found." }, 404);
    if (org.kind === "admin") return json(request, { error: "Admin organization cannot be purged." }, 422);

    const { data: students } = await client.from("students").select("*").eq("organization_id", organizationId);
    let documentsDeleted = 0;
    for (const student of students || []) {
      const { data: documents } = await client.from("documents").select("*").eq("student_id", student.id);
      const storagePaths = (documents || []).map((document) => document.storage_path).filter(Boolean);
      if (storagePaths.length) await client.storage.from("student-documents").remove(storagePaths);
      documentsDeleted += storagePaths.length;
      await client.from("documents").delete().eq("student_id", student.id);
      const piiHash = await sha256Hex(`${student.email || ""}:${student.phone || ""}:${student.id}`);
      await client.from("students").update({
        first_name: "Deleted",
        last_name: "Student",
        email: `deleted-${piiHash.slice(0, 20)}@bizzlo.invalid`,
        phone: null,
      }).eq("id", student.id);
    }

    await client.from("profiles").update({ is_active: false }).eq("organization_id", organizationId);
    await client.from("organizations").update({ status: "purged" }).eq("id", organizationId);
    await client.from("data_erasure_events").insert({
      organization_id: organizationId,
      target_type: "organization",
      target_id: organizationId,
      requested_by: admin.id,
      metadata: { students_anonymized: students?.length || 0, documents_deleted: documentsDeleted },
    });

    logEdgeEvent(request, "organization_purged", { organization_id: organizationId, actor_id: admin.id });
    return json(request, { ok: true, organization_id: organizationId, students_anonymized: students?.length || 0, documents_deleted: documentsDeleted });
  } catch (error) {
    if (error instanceof Response) return error;
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected purge error." }, 500);
  }
}

serve(handlePurgeOrganization);

