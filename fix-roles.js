const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';
const SUPER_ADMIN_EMAIL = 'tarinmoymukherjee@gmail.com';

async function request(path, method, body = null) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || JSON.stringify(err));
    }
    return res.json();
}

async function fixRoles() {
    console.log('--- STARTING ROLE FIX ---');

    try {
        // 1. Demote everyone else
        console.log('Demoting other admins...');
        await request('users?email=neq.' + SUPER_ADMIN_EMAIL, 'PATCH', { role: 'restaurant' });
        console.log('✓ All other users set to "restaurant" role.');

        // 2. Promote the Super Admin
        console.log(`Promoting ${SUPER_ADMIN_EMAIL} to super_admin...`);
        const promo = await request('users?email=eq.' + SUPER_ADMIN_EMAIL, 'PATCH', { 
            role: 'super_admin', 
            restaurant_id: null 
        });
        
        if (promo.length === 0) {
            console.warn('⚠️ Super admin user not found in public.users table.');
        } else {
            console.log('✓ Super admin promoted successfully.');
        }

        // 3. Sync Restaurant Links
        console.log('Syncing restaurant links for owners...');
        const restaurants = await request('restaurants?select=id,owner_email', 'GET');
        
        for (const rest of restaurants) {
            if (rest.owner_email === SUPER_ADMIN_EMAIL) continue;

            await request('users?email=eq.' + rest.owner_email, 'PATCH', { 
                restaurant_id: rest.id 
            });
            console.log(`✓ Linked ${rest.owner_email} to restaurant ${rest.id}`);
        }

        console.log('--- ROLE FIX COMPLETE ---');
    } catch (err) {
        console.error('Fatal Error:', err.message);
    }
}

fixRoles();
