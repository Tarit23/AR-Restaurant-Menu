const fs = require('fs');
const path = require('path');

const FUNCTION_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co/functions/v1/temp-sql';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk'; 

async function executeSQL() {
    const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
    const query = fs.readFileSync(schemaPath, 'utf8');

    console.log('Sending SQL to Edge Function...');
    try {
        const res = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ query })
        });

        const data = await res.json();
        if (res.ok) {
            console.log('✓ SQL Executed Successfully');
            console.log(data);
        } else {
            console.error('✕ Execution Error:', data);
        }
    } catch (e) {
        console.error('✕ Fatal Error:', e.message);
    }
}

executeSQL();
