
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTMzNzIsImV4cCI6MjA5MTc4OTM3Mn0.wIhnSy1L-U9s-BH4UB7KE6Wf3nt-PyGyaKutMMsv0tk';

async function applyFix() {
  const sqlPath = path.join(__dirname, 'supabase', 'fix_pending_issue.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Applying DB Fix via temp-sql...");
  
  const res = await fetch(`${SUPABASE_URL}/functions/v1/temp-sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  const body = await res.text();
  console.log("Response:", body);
}

applyFix();
