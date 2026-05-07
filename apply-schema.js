const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';

async function runSQL(query) {
    console.log('  Executing SQL block...');
    try {
        const res = await fetch(`${SUPABASE_URL}/pg-meta/v1/query`, {
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
            console.log('  ✓ Success');
            return true;
        } else {
            console.error('  ✕ Error:', data.message || JSON.stringify(data));
            return false;
        }
    } catch (e) {
        console.error('  ✕ Fatal Error:', e.message);
        return false;
    }
}

async function main() {
    const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
    console.log(`\n▶ Applying schema from ${schemaPath}...`);
    
    if (!fs.existsSync(schemaPath)) {
        console.error('Error: schema.sql not found');
        return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into parts if needed, but pg-meta/query can handle large blocks
    await runSQL(schema);
    
    console.log('\n▶ Schema application complete.\n');
}

main();
