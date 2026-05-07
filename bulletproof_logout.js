
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
  
  // 1. Standardize Sidebar Footer HTML
  const isAltRole = file.includes('admin/');
  const avatar = isAltRole ? 'A' : 'R';
  const roleTitle = isAltRole ? 'Super Admin' : 'Restaurant Owner';
  const nameId = isAltRole ? 'adminName' : 'restaurantName';
  
  const footerHtml = `    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar" id="avatarInitial">${avatar}</div>
        <div style="flex:1; min-width:0;">
          <div class="user-name" id="${nameId}">Loading...</div>
          <div class="user-role">${roleTitle}</div>
        </div>
      </div>
      <div class="sidebar-logout">
        <button class="btn-logout" id="logoutBtn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign Out
        </button>
      </div>
    </div>`;

  content = content.replace(/<div class="sidebar-footer">[\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/, footerHtml + '\n  </aside>');

  // 2. Standardize Script Logic
  // Remove all previous logout attempts
  content = content.replace(/\/\/ Immediate logout listener attachment[\s\S]*?\}, 0\);/g, '');
  content = content.replace(/const logoutBtn = document\.getElementById\('logoutBtn'\);[\s\S]*?\}\s*\}\s*\}\);\s*\}\s*/g, '');
  content = content.replace(/import \{ authManager \} from '\.\.\/js\/auth\.js';/g, '');
  content = content.replace(/import \{ supabase \} from '\.\.\/js\/supabase-config\.js';/g, '');

  // Add the imports back at the very top of the script tag
  content = content.replace('<script type="module">', '<script type="module">\n  import { supabase } from "../js/supabase-config.js";\n  import { authManager } from "../js/auth.js";');

  // Add a global click listener for the logout button (bulletproof)
  const globalListener = `
  // Global Logout Handler
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#logoutBtn');
    if (btn) {
      e.preventDefault();
      if (confirm('Are you sure you want to sign out?')) {
        try {
          await supabase.auth.signOut();
          window.location.href = window.location.origin + '/login.html';
        } catch (err) {
          console.error('Logout failed:', err);
          window.location.href = window.location.origin + '/login.html';
        }
      }
    }
  });
  `;

  // Inject the global listener at the start of the module script
  content = content.replace('import { authManager } from "../js/auth.js";', 'import { authManager } from "../js/auth.js";\n' + globalListener);

  // 3. Fix the restaurant array access one last time (ensuring no duplicates)
  content = content.replace('const restaurant = profile.restaurants;', 'const restaurant = Array.isArray(profile.restaurants) ? profile.restaurants[0] : profile.restaurants;');
  
  // Also fix the case where I might have already added the fix
  // const restaurant = Array.isArray(profile.restaurants) ? profile.restaurants[0] : profile.restaurants;
  // (No change needed if it's already there)

  fs.writeFileSync(fullPath, content);
  console.log(`Deep fixed ${file}`);
});
