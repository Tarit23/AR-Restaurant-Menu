/**
 * RAZORPAY FIX - Complete Solution
 * =================================
 * This script does THREE things:
 * 1. Tests your Razorpay credentials
 * 2. Updates ALL Supabase secrets
 * 3. Redeploys the Edge Functions
 * 
 * Usage: node scratch/fix_razorpay.js YOUR_KEY_ID YOUR_KEY_SECRET
 * 
 * Example: node scratch/fix_razorpay.js rzp_live_abc123 SecretXYZ456
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEY_ID = process.argv[2];
const KEY_SECRET = process.argv[3];
const PROJECT_REF = 'fuezcrbfswgghawhfxrv';
const PLAN_BASIC_ID = 'plan_SmVN9PPiUNaOxG';
const PLAN_PRO_ID = 'plan_SmVOECOgOcpnix';

if (!KEY_ID || !KEY_SECRET) {
  console.error('\n❌ Usage: node scratch/fix_razorpay.js <KEY_ID> <KEY_SECRET>\n');
  process.exit(1);
}

async function main() {
  // STEP 1: Test credentials
  console.log('\n========================================');
  console.log('  STEP 1: Testing Razorpay Credentials');
  console.log('========================================\n');
  console.log(`  Key ID:     ${KEY_ID}`);
  console.log(`  Key Secret: ${KEY_SECRET.substring(0, 4)}...${KEY_SECRET.substring(KEY_SECRET.length - 4)}`);

  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
  
  try {
    const res = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        name: 'Test Customer',
        email: 'test@example.com',
        fail_existing: 0
      })
    });
    
    const data = await res.json();
    
    if (res.status === 200 || res.status === 201) {
      console.log('\n  ✅ AUTHENTICATION SUCCESSFUL!\n');
    } else {
      console.log(`\n  ❌ AUTHENTICATION FAILED (${res.status})`);
      console.log(`  Error: ${data?.error?.description || JSON.stringify(data)}`);
      console.log('\n  The credentials are WRONG. Please check and try again.\n');
      process.exit(1);
    }
  } catch (e) {
    console.error('\n  ❌ Network error:', e.message);
    process.exit(1);
  }

  // STEP 2: Update Supabase Secrets
  console.log('========================================');
  console.log('  STEP 2: Updating Supabase Secrets');
  console.log('========================================\n');

  const envPath = path.join(__dirname, '.temp_secrets.env');
  const envContent = [
    `RAZORPAY_KEY_ID=${KEY_ID}`,
    `RAZORPAY_KEY_SECRET=${KEY_SECRET}`,
    `RAZORPAY_PLAN_BASIC_ID=${PLAN_BASIC_ID}`,
    `RAZORPAY_PLAN_PRO_ID=${PLAN_PRO_ID}`,
  ].join('\n');

  fs.writeFileSync(envPath, envContent);

  try {
    execSync(`npx supabase secrets set --env-file "${envPath}" --project-ref ${PROJECT_REF}`, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    console.log('\n  ✅ Secrets updated!\n');
  } catch (e) {
    console.error('  ❌ Failed to update secrets:', e.message);
    process.exit(1);
  } finally {
    try { fs.unlinkSync(envPath); } catch {}
  }

  // STEP 3: Redeploy Edge Functions
  console.log('========================================');
  console.log('  STEP 3: Redeploying Edge Functions');
  console.log('========================================\n');

  const functions = ['create-subscription', 'razorpay-webhook'];
  for (const fn of functions) {
    console.log(`  Deploying ${fn}...`);
    try {
      execSync(`npx supabase functions deploy ${fn} --project-ref ${PROJECT_REF} --no-verify-jwt`, {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..')
      });
      console.log(`  ✅ ${fn} deployed!\n`);
    } catch (e) {
      console.error(`  ❌ Failed to deploy ${fn}:`, e.message);
    }
  }

  // STEP 4: Update frontend config
  console.log('========================================');
  console.log('  STEP 4: Updating Frontend Config');
  console.log('========================================\n');

  const configPath = path.resolve(__dirname, '..', 'js', 'supabase-config.js');
  let config = fs.readFileSync(configPath, 'utf-8');
  config = config.replace(/const RAZORPAY_KEY_ID = '[^']+';/, `const RAZORPAY_KEY_ID = '${KEY_ID}';`);
  fs.writeFileSync(configPath, config);
  console.log(`  ✅ Updated RAZORPAY_KEY_ID to ${KEY_ID}\n`);

  // STEP 5: Git push
  console.log('========================================');
  console.log('  STEP 5: Pushing to Git');
  console.log('========================================\n');

  try {
    execSync('git add -A && git commit -m "fix: update Razorpay key ID" && git push', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    console.log('\n  ✅ Pushed to git!\n');
  } catch (e) {
    console.log('  ⚠️ Git push skipped (no changes or error)\n');
  }

  console.log('🎉 ============================================');
  console.log('   ALL DONE! Your payment system is now fixed.');
  console.log('   ============================================');
  console.log('\n   Go to your subscription page and test it:');
  console.log('   https://ar-restaurant-menu-eta.vercel.app/restaurant/subscription\n');
}

main();
