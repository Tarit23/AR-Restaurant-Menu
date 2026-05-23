const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';

async function runSQL(query) {
    console.log('  Executing:', query.substring(0, 80) + '...');
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
        console.log('  ✓ Success:', JSON.stringify(data).substring(0, 100));
        return true;
    } else {
        console.error('  ✕ Error:', data.message || JSON.stringify(data));
        return false;
    }
}

async function main() {
    console.log('\n▶ Running description column migration...');
    const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'add_description.sql'), 'utf8');
    const success = await runSQL(sql);
    if (success) {
        console.log('\n✓ Migration complete! description column added to menu_items.\n');
    } else {
        console.log('\n⚠ Migration may have failed. Check output above.\n');
        console.log('You can also run this manually in Supabase SQL Editor:');
        console.log('  ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;\n');
    }
}

main().catch(e => console.error('Fatal:', e.message));
