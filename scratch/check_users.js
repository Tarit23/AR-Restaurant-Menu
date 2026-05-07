
const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTMzNzIsImV4cCI6MjA5MTc4OTM3Mn0.wIhnSy1L-U9s-BH4UB7KE6Wf3nt-PyGyaKutMMsv0tk';

async function checkUsers() {
  const query = "SELECT id, email, role FROM users";
  
  const res = await fetch(`${SUPABASE_URL}/functions/v1/temp-sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log("Users:", JSON.stringify(data, null, 2));
}

checkUsers();
