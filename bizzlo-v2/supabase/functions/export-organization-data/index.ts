import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, corsHeaders, json, logEdgeEvent, userClient } from "../_shared/security.ts";

async function requireAdmin(request: Request) {
  const client = userClient(request.headers.get("authorization") || "");
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { data: profile, error } = await client.from("profiles").select("id, role").eq("id", authData.user.id).single();
  if (error || profile?.role !== "admin") throw new Response(JSON.stringify({ error: "Admin access required." }), { status: 403 });
  return profile;
}

export async function handleExportOrganizationData(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);
    const admin = await requireAdmin(request);
    const { organization_id: organizationId } = await request.json().catch(() => ({}));
    if (!organizationId) return json(request, { error: "organization_id is required." }, 400);

    const client = adminClient();
    const [students, applications, documents, commissions, auditEvents] = await Promise.all([
      client.from("students").select("*").eq("organization_id", organizationId),
      client.from("applications").select("*").eq("organization_id", organizationId),
      client.from("documents").select("*").eq("organization_id", organizationId),
      client.from("commissions").select("*").eq("organization_id", organizationId),
      client.from("audit_events").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10000),
    ]);
    const firstError = [students, applications, documents, commissions, auditEvents].find((result) => result.error)?.error;
    if (firstError) return json(request, { error: firstError.message }, 400);

    const documentsWithLinks = await Promise.all((documents.data || []).map(async (document) => {
      const { data } = await client.storage
        .from(document.storage_bucket || "student-documents")
        .createSignedUrl(document.storage_path, 7 * 24 * 60 * 60);
      return { ...document, signed_url_7d: data?.signedUrl || null };
    }));

    const payload = {
      exported_at: new Date().toISOString(),
      organization_id: organizationId,
      students: students.data || [],
      applications: applications.data || [],
      documents: documentsWithLinks,
      commissions: commissions.data || [],
      audit_events: auditEvents.data || [],
    };

    logEdgeEvent(request, "organization_data_exported", { organization_id: organizationId, actor_id: admin.id });
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders(request),
        "content-type": "application/json",
        "content-disposition": `attachment; filename="bizzlo-org-${organizationId}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected export error." }, 500);
  }
}

serve(handleExportOrganizationData);

