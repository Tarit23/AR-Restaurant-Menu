/**
 * Local Edge Function Test Utility
 * ================================
 * This script allows you to test the create-subscription function logic.
 * Note: You need a valid Supabase JWT to test the manual verification part.
 */

const fetch = require('node-fetch');

async function testCreateSubscription() {
    const FUNC_URL = 'http://localhost:54321/functions/v1/create-subscription'; // If running locally via 'supabase start'
    // OR use the live URL:
    // const FUNC_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co/functions/v1/create-subscription';
    
    const JWT = 'YOUR_USER_JWT'; // Get this from localStorage in your browser
    const RESTAURANT_ID = 'YOUR_RESTAURANT_ID';

    console.log('Testing create-subscription...');

    try {
        const res = await fetch(FUNC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({
                restaurantId: RESTAURANT_ID,
                plan: 'basic',
                email: 'test@example.com',
                name: 'Test Restaurant'
            })
        });

        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

// console.log('Instructions: Fill in JWT and RESTAURANT_ID, then uncomment the call below.');
// testCreateSubscription();
