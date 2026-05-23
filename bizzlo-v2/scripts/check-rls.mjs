import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.rpc('check_public_rls');
if (error) {
  console.error(error.message);
  process.exit(1);
}

const missing = (data || []).filter((row) => !row.rls_enabled);
if (missing.length) {
  console.error(`RLS disabled on: ${missing.map((row) => row.table_name).join(', ')}`);
  process.exit(1);
}

console.log(`PASS: RLS enabled on ${(data || []).length} public tables.`);
