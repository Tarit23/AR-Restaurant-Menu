const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

async function test() {
  console.log('Testing Loyalty Tables via REST...');
  
  // Test loyalty_customers table
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_customers?select=id`, {
      method: 'GET',
      headers: headers
    });
    console.log('loyalty_customers status:', res.status);
    const body = await res.text();
    console.log('loyalty_customers response:', body.substring(0, 200));
  } catch (e) {
    console.error('loyalty_customers request failed:', e.message);
  }

  // Test loyalty_settings table
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_settings?select=restaurant_id`, {
      method: 'GET',
      headers: headers
    });
    console.log('loyalty_settings status:', res.status);
    const body = await res.text();
    console.log('loyalty_settings response:', body.substring(0, 200));
  } catch (e) {
    console.error('loyalty_settings request failed:', e.message);
  }

  // Test RPC Function
  try {
    const targetDate = new Date().toISOString().split('T')[0];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_todays_birthdays`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ target_date: targetDate })
    });
    console.log('get_todays_birthdays RPC status:', res.status);
    const body = await res.text();
    console.log('get_todays_birthdays RPC response:', body.substring(0, 200));
  } catch (e) {
    console.error('get_todays_birthdays RPC request failed:', e.message);
  }
}

test();
