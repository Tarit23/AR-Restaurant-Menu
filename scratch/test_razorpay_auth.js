/**
 * Razorpay Auth Test Script
 * ========================
 * Usage: node scratch/test_razorpay_auth.js <KEY_ID> <KEY_SECRET>
 * 
 * This tests the Razorpay API credentials LOCALLY before setting them in Supabase.
 * If this script succeeds, the Edge Function will also succeed.
 */

const KEY_ID = process.argv[2];
const KEY_SECRET = process.argv[3];

if (!KEY_ID || !KEY_SECRET) {
  console.error('\n❌ Usage: node scratch/test_razorpay_auth.js <KEY_ID> <KEY_SECRET>');
  console.error('   Example: node scratch/test_razorpay_auth.js rzp_live_xxx yourSecretHere\n');
  process.exit(1);
}

console.log('\n🔑 Testing Razorpay credentials...');
console.log(`   Key ID: ${KEY_ID}`);
console.log(`   Secret: ${KEY_SECRET.substring(0, 4)}...${KEY_SECRET.substring(KEY_SECRET.length - 4)}`);

const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

fetch('https://api.razorpay.com/v1/customers', {
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
})
  .then(async (res) => {
    const data = await res.json();
    if (res.status === 200 || res.status === 201) {
      console.log('\n✅ AUTHENTICATION SUCCESSFUL!');
      console.log(`   Customer ID: ${data.id}`);
      console.log('\n   These credentials are VALID. You can now set them in Supabase.\n');
    } else if (res.status === 401) {
      console.log('\n❌ AUTHENTICATION FAILED (401)');
      console.log('   The Key ID or Key Secret is WRONG.');
      console.log('   Response:', JSON.stringify(data, null, 2));
      console.log('\n   → You need to regenerate keys in Razorpay Dashboard.\n');
    } else {
      console.log(`\n⚠️ Unexpected response (${res.status}):`);
      console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch((err) => {
    console.error('\n❌ Network Error:', err.message);
  });
