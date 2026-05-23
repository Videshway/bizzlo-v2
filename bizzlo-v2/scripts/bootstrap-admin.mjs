import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.BIZZLO_ADMIN_EMAIL;
const adminPassword = process.env.BIZZLO_ADMIN_PASSWORD;
const adminName = process.env.BIZZLO_ADMIN_NAME || 'Videshway Admin';

if (!supabaseUrl || !serviceRoleKey || !adminEmail) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or BIZZLO_ADMIN_EMAIL.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function resolveUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

let user = await resolveUserByEmail(adminEmail);
if (!user) {
  const createPayload = {
    email: adminEmail,
    email_confirm: true,
    user_metadata: { full_name: adminName, role: 'admin' },
  };
  if (adminPassword) createPayload.password = adminPassword;

  const { data, error } = await supabase.auth.admin.createUser(createPayload);
  if (error) throw error;
  user = data.user;
  console.log(`Created admin auth user: ${adminEmail}`);
} else {
  console.log(`Admin auth user already exists: ${adminEmail}`);
}

let { data: organization, error: orgLookupError } = await supabase
  .from('organizations')
  .select('*')
  .eq('name', 'Videshway')
  .eq('kind', 'admin')
  .maybeSingle();

if (orgLookupError) throw orgLookupError;

if (!organization) {
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: 'Videshway',
      kind: 'admin',
      counselor_limit: 100,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) throw error;
  organization = data;
}

const { error: profileError } = await supabase
  .from('profiles')
  .upsert({
    id: user.id,
    organization_id: organization.id,
    full_name: adminName,
    email: adminEmail.toLowerCase(),
    role: 'admin',
    is_active: true,
  });

if (profileError) throw profileError;

console.log(`Admin profile ready: ${adminEmail}`);
