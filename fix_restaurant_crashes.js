
const fs = require('fs');
const path = require('path');

const files = [
  'restaurant/index.html',
  'restaurant/menu.html',
  'restaurant/subscription.html',
  'restaurant/qr.html'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // 1. Fix array access for restaurants
  // Replace: const restaurant = profile.restaurants;
  // With: const restaurant = Array.isArray(profile.restaurants) ? profile.restaurants[0] : profile.restaurants;
  content = content.replace(
    'const restaurant = profile.restaurants;',
    'const restaurant = Array.isArray(profile.restaurants) ? profile.restaurants[0] : profile.restaurants;'
  );

  // 2. Wrap initialization in try-catch to protect the logout button
  // And move logout button listener to the top of the script
  
  // Find the start of the script
  const scriptStartRegex = /<script type="module">/;
  const logoutListener = `
    import { authManager } from '../js/auth.js';
    import { supabase } from '../js/supabase-config.js';
    
    // Immediate logout listener attachment
    setTimeout(() => {
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (confirm('Are you sure you want to sign out?')) {
            try {
              await authManager.signOut();
              window.location.href = '/login.html';
            } catch (err) {
              console.error('Sign out error:', err);
              window.location.href = '/login.html';
            }
          }
        });
      }
    }, 0);
  `;

  // Remove existing logout logic if any (the one I added earlier)
  content = content.replace(/const logoutBtn = document\.getElementById\('logoutBtn'\);[\s\S]*?\}\s*\}\s*\}\);\s*\}\s*/, '');
  // Also remove the imports if they are already there to avoid duplicates
  content = content.replace(/import \{ authManager \} from '\.\.\/js\/auth\.js';\s*/, '');
  // content = content.replace(/import \{ supabase \} from '\.\.\/js\/supabase-config\.js';\s*/, '');

  // Inject at the top of the script
  content = content.replace(scriptStartRegex, '<script type="module">' + logoutListener);

  // 3. Fix the 'cli' typo if present
  content = content.replace("addEventListener('cli'", "addEventListener('click'");

  fs.writeFileSync(fullPath, content);
  console.log(`Fixed ${file}`);
});
