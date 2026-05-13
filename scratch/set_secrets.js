/**
 * Razorpay Secrets Updater
 * ========================
 * Usage: node scratch/set_secrets.js <KEY_ID> <KEY_SECRET>
 * 
 * This sets ALL Razorpay secrets in Supabase AND redeploys the Edge Functions.
 * Run this AFTER test_razorpay_auth.js confirms the credentials work.
 */

const { execSync } = require('child_process');

const KEY_ID = process.argv[2];
const KEY_SECRET = process.argv[3];
const PROJECT_REF = 'fuezcrbfswgghawhfxrv';

// These plan IDs are verified from the Razorpay Dashboard
const PLAN_BASIC_ID = 'plan_SmVN9PPiUNaOxG';
const PLAN_PRO_ID = 'plan_SmVOECOgOcpnix';

if (!KEY_ID || !KEY_SECRET) {
  console.error('\n❌ Usage: node scratch/set_secrets.js <KEY_ID> <KEY_SECRET>\n');
  process.exit(1);
}

console.log('\n🔧 Setting Supabase secrets...\n');

const secrets = {
  RAZORPAY_KEY_ID: KEY_ID,
  RAZORPAY_KEY_SECRET: KEY_SECRET,
  RAZORPAY_PLAN_BASIC_ID: PLAN_BASIC_ID,
  RAZORPAY_PLAN_PRO_ID: PLAN_PRO_ID,
};

// Build the --env-file approach: write a temp .env and use supabase secrets set
const envLines = Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n');
const fs = require('fs');
const envPath = require('path').join(__dirname, '.temp_secrets.env');
fs.writeFileSync(envPath, envLines);

try {
  console.log('   Setting secrets via Supabase CLI...');
  execSync(`npx supabase secrets set --env-file "${envPath}" --project-ref ${PROJECT_REF}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('\n✅ All Razorpay secrets updated successfully!\n');

  console.log('🚀 Redeploying create-subscription function...');
  execSync(`npx supabase functions deploy create-subscription --project-ref ${PROJECT_REF} --no-verify-jwt`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('\n✅ create-subscription deployed!\n');

  console.log('🚀 Redeploying razorpay-webhook function...');
  execSync(`npx supabase functions deploy razorpay-webhook --project-ref ${PROJECT_REF} --no-verify-jwt`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('\n✅ razorpay-webhook deployed!\n');

  console.log('🎉 ALL DONE! Your payment system should now work.\n');
  console.log('   Next: Go to your subscription page and click "Select Plan & Set Autopay"\n');

} catch (err) {
  console.error('\n❌ Error:', err.message);
} finally {
  // Clean up temp file
  try { fs.unlinkSync(envPath); } catch {}
}
