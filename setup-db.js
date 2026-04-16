// =============================================
// AR MENU PLATFORM — AUTOMATED SETUP SCRIPT
// Run: node setup-db.js
// Requires: SUPABASE_URL and SERVICE_ROLE_KEY
// =============================================

const SUPABASE_URL      = process.env.SUPABASE_URL      || 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';
const ADMIN_EMAIL       = process.env.ADMIN_EMAIL        || 'admin@armenu.app';
const ADMIN_PASSWORD    = process.env.ADMIN_PASSWORD     || 'ARMenu@2026!';

if (SUPABASE_URL.includes('YOUR_') || SERVICE_ROLE_KEY.includes('YOUR_')) {
  console.error('\n❌  Please set environment variables before running:');
  console.error('   $env:SUPABASE_URL="https://xxx.supabase.co"');
  console.error('   $env:SUPABASE_SERVICE_KEY="eyJ..."');
  console.error('   $env:ADMIN_EMAIL="admin@yourdomain.com"');
  console.error('   $env:ADMIN_PASSWORD="YourPassword123!"');
  process.exit(1);
}

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Prefer':        'return=minimal'
};

async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method:  'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query })
  });
  return res;
}

async function runSQL(label, query) {
  process.stdout.write(`  ${label}... `);
  try {
    // Use the Supabase SQL API via pg-meta endpoint
    const res = await fetch(`${SUPABASE_URL}/pg-meta/v1/query`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query })
    });

    if (res.ok) {
      console.log('✓');
      return true;
    } else {
      const text = await res.text();
      // Ignore "already exists" errors
      if (text.includes('already exists') || text.includes('duplicate')) {
        console.log('✓ (already exists)');
        return true;
      }
      console.log(`⚠  ${res.status}: ${text.substring(0, 120)}`);
      return false;
    }
  } catch (e) {
    console.log(`✕  ${e.message}`);
    return false;
  }
}

async function createAuthUser(email, password) {
  process.stdout.write(`  Creating admin user (${email})... `);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'super_admin' }
    })
  });

  const data = await res.json();
  if (res.ok && data.id) {
    console.log(`✓  UUID: ${data.id}`);
    return data.id;
  } else if (data.message?.includes('already been registered')) {
    console.log('✓  (already exists)');
    // Fetch existing user
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
    });
    const list = await listRes.json();
    const existing = list.users?.[0];
    if (existing) { console.log(`     UUID: ${existing.id}`); return existing.id; }
  } else {
    console.log(`✕  ${JSON.stringify(data)}`);
  }
  return null;
}

async function insertUserRecord(userId, email) {
  process.stdout.write(`  Inserting users table record... `);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method:  'POST',
    headers: { ...headers, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
    body:    JSON.stringify({ id: userId, email, role: 'super_admin' })
  });
  if (res.ok || res.status === 409) {
    console.log('✓');
    return true;
  }
  const text = await res.text();
  console.log(`✕  ${text.substring(0,120)}`);
  return false;
}

async function createBucket(name) {
  process.stdout.write(`  Creating bucket "${name}"... `);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    body:    JSON.stringify({ id: name, name, public: true, file_size_limit: 52428800 })
  });

  if (res.ok) { console.log('✓'); return true; }
  const data = await res.json();
  if (data.error === 'Duplicate' || data.message?.includes('already exists')) {
    console.log('✓  (already exists)');
    return true;
  }
  console.log(`✕  ${JSON.stringify(data).substring(0,120)}`);
  return false;
}

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  AR Menu Platform — Database Setup   ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  // ─── Test Connection ───
  console.log('▶  Testing connection...');
  const testRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  });
  if (!testRes.ok) {
    console.error(`\n❌  Cannot connect to Supabase (${testRes.status}). Check your URL and service role key.\n`);
    process.exit(1);
  }
  console.log('  Connection OK ✓\n');

  // ─── Create Tables via REST insert (tables must be created via SQL Editor) ───
  console.log('▶  Note: Tables must be created via Supabase SQL Editor.');
  console.log('   Copy & run supabase/schema.sql in your SQL editor.\n');

  // ─── Storage Buckets ───
  console.log('▶  Creating storage buckets...');
  await createBucket('menu-images');
  await createBucket('menu-models');
  console.log('');

  // ─── Admin User ───
  console.log('▶  Creating super admin user...');
  const userId = await createAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (userId) {
    // Try to insert into users table (will work after schema is run)
    await insertUserRecord(userId, ADMIN_EMAIL);
    console.log('');
    console.log('  ╔═══════════════════════════════════════╗');
    console.log('  ║  SUPER ADMIN CREDENTIALS              ║');
    console.log(`  ║  Email:    ${ADMIN_EMAIL.padEnd(27)} ║`);
    console.log(`  ║  Password: ARMenu@2026!               ║`);
    console.log(`  ║  UUID:     ${userId.substring(0,8)}...               ║`);
    console.log('  ╚═══════════════════════════════════════╝');
    console.log('');
    console.log('  ⚠  After running schema.sql, if the users INSERT failed,');
    console.log('     run this in SQL Editor:');
    console.log(`     INSERT INTO users (id, email, role) VALUES ('${userId}', '${ADMIN_EMAIL}', 'super_admin');`);
  }

  console.log('\n✓  Setup complete!\n');
  console.log('  Next steps:');
  console.log('  1. Run supabase/schema.sql in Supabase SQL Editor');
  console.log('  2. Update js/supabase-config.js with your URL and anon key');
  console.log('  3. Open http://localhost:3000/login.html');
  console.log(`  4. Login with: ${ADMIN_EMAIL} / ARMenu@2026!\n`);
}

main().catch(e => {
  console.error('\n❌  Fatal error:', e.message);
  process.exit(1);
});
