import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  adminClient as createAdminClient,
  checkRateLimit,
  corsHeaders,
  env,
  json,
  logEdgeEvent,
  userClient as createUserClient,
} from "../_shared/security.ts";

async function resolveUserIdByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await adminClient.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id || null;
}

function normalizePortalUsername(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 48);
}

function portalLoginEmail(username: string) {
  return `${normalizePortalUsername(username)}@portal.bizzlo.co`;
}

export async function handleInviteUser(request: Request) {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

    env();
    const adminClient = createAdminClient();
    const allowed = await checkRateLimit(adminClient, request, "invite-user", 30);
    if (!allowed) return json(request, { error: "Too many invite attempts. Try again in a minute." }, 429);

    const authorization = request.headers.get("authorization") || "";
    const userClient = createUserClient(authorization);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(request, { error: "Unauthorized" }, 401);

  const { data: adminProfile, error: profileError } = await userClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !adminProfile) {
    return json(request, { error: "Active Bizzlo profile not found." }, 403);
  }

  const { account_request_id: accountRequestId, password } = await request.json().catch(() => ({}));
  if (!accountRequestId) return json(request, { error: "account_request_id is required." }, 400);
  if (!password || String(password).length < 8) return json(request, { error: "Password must be at least 8 characters." }, 400);

  const { data: accountRequest, error: requestError } = await adminClient
    .from("account_requests")
    .select("*")
    .eq("id", accountRequestId)
    .single();

  if (requestError || !accountRequest) return json(request, { error: "Account request not found." }, 404);

  const isAdmin = adminProfile.role === "admin";
  const isManagerCreatingOwnCounselor = adminProfile.role === "manager"
    && accountRequest.role === "counselor"
    && accountRequest.organization_id === adminProfile.organization_id
    && accountRequest.manager_id === authData.user.id
    && accountRequest.requested_by === authData.user.id;
  if (!isAdmin && !isManagerCreatingOwnCounselor) {
    return json(request, { error: "You cannot create this account login." }, 403);
  }

  const email = String(accountRequest.email || "").trim().toLowerCase();
  if (!email) return json(request, { error: "Account request has no email." }, 400);
  const portalUsername = normalizePortalUsername(accountRequest.portal_username || email.split("@")[0]);
  if (portalUsername.length < 3) return json(request, { error: "Account request has no valid portal username." }, 400);
  const loginEmail = portalLoginEmail(portalUsername);

  const userMetadata = {
      full_name: accountRequest.full_name,
      portal_username: portalUsername,
      contact_email: email,
      role: accountRequest.role,
      organization_id: accountRequest.organization_id,
    };

  const createResult = await adminClient.auth.admin.createUser({
    email: loginEmail,
    password: String(password),
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createResult.error && !/already registered|already exists|already been registered/i.test(createResult.error.message)) {
    return json(request, { error: createResult.error.message }, 400);
  }

  const userId = createResult.data?.user?.id
    || await resolveUserIdByEmail(adminClient, loginEmail)
    || await resolveUserIdByEmail(adminClient, email);
  if (!userId) return json(request, { error: "Could not resolve created auth user." }, 400);

  if (!createResult.data?.user?.id) {
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
      email: loginEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (updateAuthError) return json(request, { error: updateAuthError.message }, 400);
  }

  const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
    id: userId,
    organization_id: accountRequest.organization_id,
    manager_id: accountRequest.role === "counselor" ? accountRequest.manager_id : null,
    full_name: accountRequest.full_name,
    email,
    portal_username: portalUsername,
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
      status: "active",
      portal_username: portalUsername,
      note: `Login created for ${email}. Portal username: ${portalUsername}.`,
    })
    .eq("id", accountRequestId);
  if (updateError) return json(request, { error: updateError.message }, 400);

  return json(request, {
    ok: true,
    email,
    role: accountRequest.role,
    full_name: accountRequest.full_name,
    portal_username: portalUsername,
    user_id: userId,
  });
  } catch (error) {
    logEdgeEvent(request, "edge_function_error", { message: error?.message || String(error) });
    return json(request, { error: error?.message || "Unexpected invite error." }, 500);
  }
}

serve(handleInviteUser);
