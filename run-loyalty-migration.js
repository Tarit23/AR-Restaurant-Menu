const fs = require('fs');
const path = require('path');

const FUNCTION_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co/functions/v1/temp-sql';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk'; 

async function runSQL(query) {
    console.log('  Executing SQL block via temp-sql Edge Function...');
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

        if (res.ok) {
            console.log('  ✓ Success');
            return true;
        } else {
            const data = await res.text();
            console.error('  ✕ Error:', data);
            return false;
        }
    } catch (e) {
        console.error('  ✕ Fatal Error:', e.message);
        return false;
    }
}

async function main() {
    const schemaPath = path.join(__dirname, 'supabase', 'loyalty-schema.sql');
    console.log(`\n▶ Applying loyalty schema from ${schemaPath}...`);
    
    if (!fs.existsSync(schemaPath)) {
        console.error('Error: loyalty-schema.sql not found');
        return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    await runSQL(schema);
    console.log('\n▶ Loyalty schema application complete.\n');
}

main().catch(e => console.error('Fatal:', e.message));
