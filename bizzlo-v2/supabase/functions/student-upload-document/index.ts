import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  adminClient,
  checkRateLimit,
  cookieValue,
  corsHeaders,
  json,
  logEdgeEvent,
  sha256Hex,
} from "../_shared/security.ts";

const bucket = "student-documents";
const maxBytes = 25 * 1024 * 1024;
const allowedTypes: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

function safeFilename(name: string) {
  return (name || "document.pdf")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateFile(file: File) {
  if (file.size > maxBytes) return "Files must be 25 MB or smaller.";
  const mime = file.type || "application/octet-stream";
  const allowedExtensions = allowedTypes[mime];
  if (!allowedExtensions) return "This file type is not allowed.";
  const filename = file.name.toLowerCase();
  if (!allowedExtensions.some((extension) => filename.endsWith(extension))) {
    return "The file extension does not match the file type.";
  }
  return "";
}

export async function handleStudentUploadDocument(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

    const client = adminClient();
    const allowed = await checkRateLimit(client, request, "student-upload-document", 20);
    if (!allowed) return json(request, { error: "Too many uploads. Try again in a minute." }, 429);

    const formData = await request.formData().catch(() => null);
    if (!formData) return json(request, { error: "Multipart form data is required." }, 400);

    const uploadToken = cookieValue(request, "bizzlo_portal") || String(formData.get("token") || "");
    const documentType = String(formData.get("document_type") || "");
    const file = formData.get("file");

    if (!uploadToken || !documentType || !(file instanceof File)) {
      return json(request, { error: "document_type, file, and a valid upload session are required." }, 400);
    }

    const validationError = validateFile(file);
    if (validationError) return json(request, { error: validationError }, 422);

    const { data: claimedRows, error: claimError } = await client.rpc("claim_student_portal_upload", {
      upload_session_hash: await sha256Hex(uploadToken),
    });
    if (claimError) return json(request, { error: claimError.message }, 400);
    const session = claimedRows?.[0];
    if (!session) return json(request, { error: "Upload session has expired or reached its upload limit." }, 410);

    const storagePath = `${session.organization_id}/${session.student_id}/${Date.now()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) return json(request, { error: uploadError.message }, 400);

    const { data: document, error: documentError } = await client
      .from("documents")
      .insert({
        organization_id: session.organization_id,
        student_id: session.student_id,
        uploaded_by: null,
        document_type: documentType,
        original_filename: file.name || `${documentType}.pdf`,
        storage_bucket: bucket,
        storage_path: storagePath,
        content_type: file.type || "application/octet-stream",
        file_size: file.size,
        status: "uploaded",
        scan_status: "pending",
      })
      .select("*")
      .single();

    if (documentError) {
      await client.storage.from(bucket).remove([storagePath]);
      return json(request, { error: documentError.message }, 400);
    }

    const { data: scannedDocument } = await client
      .from("documents")
      .update({ scan_status: "skipped" })
      .eq("id", document.id)
      .select("*")
      .single();

    logEdgeEvent(request, "document_uploaded_by_student", { student_id: session.student_id, document_id: document.id });
    return json(request, { ok: true, document: scannedDocument || document });
  } catch (error) {
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected upload error." }, 500);
  }
}

serve(handleStudentUploadDocument);
