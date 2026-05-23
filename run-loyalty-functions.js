const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';

async function applyHelperFunctions() {
  const sqlPath = path.join(__dirname, 'supabase', 'loyalty-functions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Applying loyalty helper functions via temp-sql Edge Function...");
  
  try {
    const res = await fetch('https://fuezcrbfswgghawhfxrv.supabase.co/functions/v1/temp-sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });

    const body = await res.text();
    console.log("Response:", body);
  } catch (e) {
    console.error("Error executing helper functions migration:", e.message);
  }
}

applyHelperFunctions();
