
const fs = require('fs');
const path = require('path');

const files = [
  'admin/index.html',
  'admin/menu.html',
  'admin/restaurants.html',
  'admin/payments.html',
  'admin/qr.html',
  'restaurant/index.html',
  'restaurant/menu.html',
  'restaurant/subscription.html',
  'restaurant/qr.html'
];

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // 1. Ensure authManager is imported
  if (!content.includes('import { authManager }')) {
    content = content.replace(
      "import { supabase } from '../js/supabase-config.js';",
      "import { supabase } from '../js/supabase-config.js';\n    import { authManager } from '../js/auth.js';"
    );
  }

  // 2. Replace the logout listener with a robust version
  const oldListenerRegex = /document\.getElementById\('logoutBtn'\)\.addEventListener\('click'[\s\S]*?\}\);/;
  const robustListener = `    const logoutBtn = document.getElementById('logoutBtn');
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
    }`;

  if (oldListenerRegex.test(content)) {
    content = content.replace(oldListenerRegex, robustListener);
  } else {
    // If not found, try to find the old sidebarUserBtn listener just in case
    content = content.replace(/document\.getElementById\('sidebarUserBtn'\)\.addEventListener\('click'[\s\S]*?\}\);/, robustListener);
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${file} with robust logout logic.`);
});
