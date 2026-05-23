import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, corsHeaders, json, logEdgeEvent } from "../_shared/security.ts";

export async function handleScanDocumentStub(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

    const expectedSecret = Deno.env.get("SCAN_STUB_SECRET");
    if (!expectedSecret || request.headers.get("x-scan-stub-secret") !== expectedSecret) {
      return json(request, { error: "Unauthorized" }, 401);
    }

    const { document_id: documentId } = await request.json().catch(() => ({}));
    if (!documentId) return json(request, { error: "document_id is required." }, 400);

    const client = adminClient();
    const { data, error } = await client
      .from("documents")
      .update({ scan_status: "skipped" })
      .eq("id", documentId)
      .select("*")
      .single();
    if (error) return json(request, { error: error.message }, 400);

    logEdgeEvent(request, "document_scan_stubbed", { document_id: documentId });
    return json(request, { ok: true, document: data });
  } catch (error) {
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected scan error." }, 500);
  }
}

serve(handleScanDocumentStub);
