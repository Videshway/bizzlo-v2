import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  adminClient as createAdminClient,
  checkRateLimit,
  corsHeaders,
  env,
  json,
  logEdgeEvent,
  siteUrl as configuredSiteUrl,
  userClient as createUserClient,
} from "../_shared/security.ts";

async function resolveUserIdByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await adminClient.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id || null;
}

export async function handleInviteUser(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

    env();
    const adminClient = createAdminClient();
    const allowed = await checkRateLimit(adminClient, request, "invite-user", 30);
    if (!allowed) return json(request, { error: "Too many invite attempts. Try again in a minute." }, 429);

    const siteUrl = configuredSiteUrl();
    const authorization = request.headers.get("authorization") || "";
    const userClient = createUserClient(authorization);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(request, { error: "Unauthorized" }, 401);

  const { data: adminProfile, error: profileError } = await userClient
    .from("profiles")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || adminProfile?.role !== "admin") {
    return json(request, { error: "Only Videshway admin can send account invites." }, 403);
  }

  const { account_request_id: accountRequestId } = await request.json().catch(() => ({}));
  if (!accountRequestId) return json(request, { error: "account_request_id is required." }, 400);

  const { data: accountRequest, error: requestError } = await adminClient
    .from("account_requests")
    .select("*")
    .eq("id", accountRequestId)
    .single();

  if (requestError || !accountRequest) return json(request, { error: "Account request not found." }, 404);

  const email = String(accountRequest.email || "").trim().toLowerCase();
  if (!email) return json(request, { error: "Account request has no email." }, 400);

  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/`,
    data: {
      full_name: accountRequest.full_name,
      role: accountRequest.role,
      organization_id: accountRequest.organization_id,
    },
  });

  if (inviteResult.error && !/already registered|already exists|already been registered/i.test(inviteResult.error.message)) {
    return json(request, { error: inviteResult.error.message }, 400);
  }

  const userId = inviteResult.data.user?.id || await resolveUserIdByEmail(adminClient, email);
  if (!userId) return json(request, { error: "Could not resolve invited auth user." }, 400);

  const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
    id: userId,
    organization_id: accountRequest.organization_id,
    manager_id: accountRequest.role === "counselor" ? accountRequest.manager_id : null,
    full_name: accountRequest.full_name,
    email,
    role: accountRequest.role,
    is_active: true,
  });

  if (profileUpsertError) return json(request, { error: profileUpsertError.message }, 400);

  if (accountRequest.role === "manager") {
    const { error: orgError } = await adminClient
      .from("organizations")
      .update({
        primary_manager_id: userId,
        status: "active",
      })
      .eq("id", accountRequest.organization_id);
    if (orgError) return json(request, { error: orgError.message }, 400);
  }

  const { error: updateError } = await adminClient
    .from("account_requests")
    .update({
      status: "invited",
      note: `Invite email sent to ${email}.`,
    })
    .eq("id", accountRequestId);
  if (updateError) return json(request, { error: updateError.message }, 400);

  return json(request, {
    ok: true,
    email,
    user_id: userId,
  });
  } catch (error) {
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected invite error." }, 500);
  }
}

serve(handleInviteUser);
